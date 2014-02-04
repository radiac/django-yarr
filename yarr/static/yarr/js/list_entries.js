/** ++ In development ++
    Current position is // ++ HERE
    Need to strip // ++
    Need to remove global vars at top
    Split Layout into Control, Feed
    Refactor Layout/Entries ready for mobile layout replacement class
        Rename Layout to ListEntries
        Add Layout ready for MobileLayout
            Handle infinite scroll
            Pass everything else up to ListEntries
    Extend Yarr.Entry to use either a EntryRender or MobileEntryRender class
*/

$(function () {
    var Yarr = window.YARR;
    if (!Yarr) {
        return;
    }
    
    /**************************************************************************
    **                                                          Declare vars
    */
    
    var $con = Yarr.$con;
    
    // Key codes
    var KEY_N = 78,
        KEY_P = 80,
        KEY_J = 74,
        KEY_K = 75,
        KEY_V = 86,
        KEY_RET = 13
    ;
    var 
        /*
        ** Constants
        */
        ENTRY_UNREAD = Yarr.ENTRY_UNREAD,
        ENTRY_READ = Yarr.ENTRY_READ,
        ENTRY_SAVED = Yarr.ENTRY_SAVED,
        
        MODE_EXPANDED = 'expanded',
        MODE_LIST = 'list',
        FEEDS_VISIBLE = 'visible',
        FEEDS_HIDDEN = 'hidden',
        
        
        
        /*
        ** Settings
        */
        
        // Switch items when scrolling past this point
        scrollSwitchMargin = 100,
        
        // Load more entries for infinite scroll when this many pixels left
        scrollInfiniteMargin = 300,
        
        options = {
            // Display mode; one of:
            //      expanded    Traditional list of titles and bodies
            //      list        List of titles, with expanding bodies
            // ++ rename displayMode to mode
            displayMode: Yarr.Cookie.get('yarr-displayMode', MODE_EXPANDED),
        
            // Whether or not the control bar and feed list should be fixed
            layoutFixed: !!$con.data('layout-fixed'),
            
            // Feed list visiblity; either visible or hidden, or null for CSS
            feedListShow: Yarr.Cookie.get('yarr-feedListShow', null),
            
            // Number of entries on a page
            pageLength: $con.data('api-page-length'),
            
            // List of available pks
            pkAvailable: String($con.data('available-pks'))
        }
    ;
    
    
    /** Layout
        Manages control bar, feed bar, layout and trigger infinite scrolling
    */
    function Layout(options, $scroller) {
        /** Initialise the layout
            Pass the scroll container
        */
        this.$scroller = $scroller || $(window);
        var $base = $scroller || $('body');
        
        // Set options
        this.options = options;
        this.displayMode = options.displayMode;
        this.layoutFixed = options.layoutFixed;
        this.feedListShow = options.feedListShow;
        
        // Find elements
        this.$control = $base.find('.yarr_control');
        this.$content = $base.find('.yarr_content');
        this.$feedList = $base.find('.yarr_feed_list');
        
        // Initialise related classes
        this.keys = new KeyHandler($base);
        this.entries = new Entries(this, $base.find('.yarr_entry'));
        
        // Set up control bar and fixed layout
        this.setupControl();
        if (this.layoutFixed) {
            this.fixLayout();
        }
        var thisLayout = this;
        this.$scroller
            .resize(function () { thisLayout.onResize(); })
            .scroll(function () { thisLayout.onScroll(); })
        ;
        this.onResize();
    }
    Layout.prototype = $.extend(Layout.prototype, {
        // Settings from options
        options: null,
        displayMode: MODE_EXPANDED,
        layoutFixed: true,
        controlIsFixed: false,
        feedListShow: null,
        controlTop: null,
        controlBottom: null,
        scrollCutoff: null,
        entryMargin: null,
        
        setupControl: function () {
            /** Remove pagination links, add scroll buttons */
            
            // Adds infinite scroll support, so disable pagination links
            this.$control.find('.yarr_paginated').remove();
            
            // Add mode switch and initialise
            var thisLayout = this;
            this.modeButton = this._mkButton(
                'Mode',
                function () {
                    thisLayout.switchMode(
                        (thisLayout.displayMode == MODE_LIST)
                        ? MODE_EXPANDED : MODE_LIST
                    );
                }
            );
            $('<ul class="yarr_menu_mode" />')
                .append($('<li/>').append(this.modeButton))
                .insertAfter(this.$control.find('.yarr_menu_op'))
            ;
            this.switchMode(this.displayMode);
            
            // Add next/prev buttons
            $('<ul class="yarr_nav"/>')
                .append($('<li/>').append(
                    this._mkIconButton('yarr_previous', function () {
                        return thisLayout.entries.selectPrevious();
                    })
                ))
                .append(' ')
                .append($('<li/>').append(
                    this._mkIconButton('yarr_next', function () {
                        return thisLayout.entries.selectNext();
                    })
                ))
                .appendTo(this.$control)
            ;
            
            // Calculate entry margin for autoscrolling
            this.controlBottom = this.$control.offset().top + this.$control.outerHeight();
            this.entryMargin = this.$feedList.offset().top - this.controlBottom;
        },
        fixLayout: function () {
            /** Prepare fixed layout */
            
            // Add feed switch and initialise
            var thisLayout = this;
            $('<ul class="yarr_menu_feed"/ >')
                .append($('<li/>').append(
                    this._mkButton('Feeds', function () {
                        thisLayout.toggleFeed();
                    })
                ))
                .insertBefore(this.$control.find('.yarr_menu_filter'))
            ;
            
            // Clone control bar ready for fixed position
            // Need to clone so the original can stay in position
            this.$controlFixed = this.$control
                .clone(true)
                .insertAfter(this.$control)
                .css({
                    'position': 'fixed',
                    'top':      0
                })
                .hide()
            ;
            
            // Prepare the fixed feedList
            this.$feedList.css({
                'position': 'fixed',
                'top':      this.controlBottom,
                'bottom':   this.$feedList.css('margin-top')
            });
            
            // Toggle the feed list visibility, if preference in cookies
            if (this.feedListShow) {
                this.toggleFeed(this.feedListShow);
            }
        },
        switchMode: function (newMode) {
            /** Switch display mode between expanded and list view */
            
            // Switch the mode
            if (newMode == MODE_LIST) {
                this.$content.addClass('yarr_mode_list');
                this.modeButton.text('Expanded view');
            } else {
                this.$content.removeClass('yarr_mode_list');
                this.modeButton.text('List view');
            }
            
            // Update var and cookie
            this.displayMode = newMode;
            Yarr.Cookie.set('yarr-displayMode', newMode);
            
            // Scroll to the top
            this.$scroller.scrollTop(0);
            
            // Ensure full screen
            this.ensureFullScreen();
        },
        
        toggleFeed: function(to) {
            /** Toggle the visibility of the feed
                Only available if layoutFixed
            */
            // Current state is determined by checking for element visibility
            // This allows the CSS to decide the default status with media rules
            var thisLayout = this,
                speed = 'fast',
                isOpen = this.$feedList.is(":visible"),
                
                // Add dummy element to get true CSS values
                $dummyList = $('<div class="yarr_feed_list">&nbsp;</div>')
            ;
            
            // Check if the switch isn't needed
            if ((to == FEEDS_VISIBLE && isOpen)
                || (to == FEEDS_HIDDEN && !isOpen)
            ) {
                return;
            }
            
            // Special action for mobile layout
            if ($dummyList.css('position') == 'relative') {
                if (isOpen) {
                    this.$feedList.slideUp(speed, function () {
                        this.$feedList.removeAttr('style');
                    });
                } else {
                    this.$feedList.slideDown(speed);
                }
                return;
            }
            
            // Normal sidebar layout
            if (isOpen) {
                this.$feedList.animate({'width': 0}, speed, function () {
                    thisLayout.$feedList.hide();
                });
                this.$content.animate({'margin-left': 0}, speed);
                
            } else {
                var $dummyContent = $('<div class="yarr_content">&nbsp;</div>');
                
                this.$feedList
                    .show()
                    .animate({'width': $dummyList.width()}, function () {
                        thisLayout.$feedList.removeAttr('style');
                    })
                ;
                this.$content
                    .animate(
                        {'margin-left': $dummyContent.css('margin-left')},
                        function () {
                            thisLayout.$content.removeAttr('style');
                        }
                    );
            }
            
            // Save the current display configuration in a cookie
            // This will disable initial auto-sensing between screen sizes,
            this.feedListShow = isOpen ? FEEDS_HIDDEN : FEEDS_VISIBLE;
            Yarr.Cookie.set('yarr-feedListShow', this.feedListShow);
        },
        
        ensureFullScreen: function() {
            /** Ensure that enough entries have loaded to fill the screen, if more
                are available.
                
                Infinite scroll can't trigger without a full screen to scroll.
            */
            
            // Only in list mode
            if (this.displayMode != MODE_LIST) {
                return;
            }
            
            // Get the height from the bottom of the loaded entries to the bottom
            // of the viewport, plus the infinite scroll margin
            var gap = (
                (this.$scroller.innerHeight() + scrollInfiniteMargin)
                - (this.$content.offset().top + this.$content.outerHeight())
            );
            
            // If there's a gap, tell Entries to load enough entries to exceed
            // the infinite scroll margin, by finding height of one entry
            this.entries.loadInfiniteScroll(
                Math.ceil(gap / this.entries.entries[0].$el.outerHeight())
            );
            
            this.entries.loadInfiniteScroll(
            
            );
        },
        
        updateScrollTrigger: function () {
            this.scrollInfiniteTrigger = this.$content.outerHeight()
                + this.$content.position().top
                - this.$scroller.innerHeight() - scrollInfiniteMargin
            ;
        },
        
        scrollTo: function (y) {
            /** Scroll the container to the given offset */
            this.$scroller.scrollTop(
                (y - this.$control.outerHeight()) - this.entryMargin
            );
        },
        
        

// ++ here
        onResize: function () {
            /** Event handler for when the scroller resizes
                Updates the fixed control bar position, and calls entriesResized
            */
            // Get position of $control
            var controlOffset = this.$control.offset(),
                controlHeight = this.$control.outerHeight()
            ;
            
            // Find position of controlTop and scrollCutoff (may have changed)
            this.controlTop = controlOffset.top;
            this.scrollCutoff = controlHeight + scrollSwitchMargin;
            
            // Move $controlFixed to occupy same horizontal position as $control
            if (this.layoutFixed) {
                this.$controlFixed.css({
                    left:   controlOffset.left,
                    width:  this.$control.width()
                });
            }
            
            // The entries will have resized
            this.entries.entriesResized();
            this.ensureFullScreen();
        },
    
        onScroll: function () {
            /** Event handler for scrolling */
            var scrollTop = this.$scroller.scrollTop(),
                topCutoff = scrollTop + this.scrollCutoff,
                topMoved = false
            ;
            
            // Switch control bar between fixed and relative position
            if (this.layoutFixed) {
                if (scrollTop > this.controlTop) {
                    // Fixed layout
                    // Only change if changed
                    if (!this.controlIsFixed) {
                        // Switch control bar to fixed position
                        this.$controlFixed.show();
                        this.controlIsFixed = true;
                        
                        // Move feed list to bottom of fixed bar
                        this.$feedList.css('top', this.$controlFixed.outerHeight());
                    }
                    
                } else {
                    // Relative layout
                    // Only switch bars if changed
                    if (this.controlIsFixed) {
                        // Switch control bar to relative position
                        this.$controlFixed.hide();
                        this.controlIsFixed = false;
                    }
                    
                    // Always move feed list to bottom of relative bar
                    this.$feedList.css('top', this.controlBottom - scrollTop);
                }
            }
            
            // Tell the entries to handle scrolling
            this.entries.handleScroll(topCutoff);
            
            // Infinite scroll
            if (scrollTop > this.scrollInfiniteTrigger) {
                this.entries.loadInfiniteScroll();
            }
        },
        
        /* Internal util functions */
        _mkButton: function (txt, fn) {
            return $('<a href="#" class="button">' + txt + '</a>')
                .click(function (e) {
                    e.preventDefault();
                    fn();
                })
            ;
        },
        _mkIconButton: function (className, fn) {
            return $('<a href="#" class="' + className + '">&nbsp;</a>')
                .click(function (e) {
                    e.preventDefault();
                    fn();
                })
            ;
        }
       
    });
    
    function Entries(layout, $el) {
        this.layout = layout;
        this.$entries = $el;
        this.pkLookup = {};
        
        // Options
        this.pageLength = layout.options.pageLength;
        this.pkAvailable = layout.options.pkAvailable;
        
        // Split pkAvailable
        if (!this.pkAvailable) {
            this.pkAvailable = [];
        } else {
            this.pkAvailable = this.pkAvailable.split(',');
        }
        
        // Initialise Entry classes
        this.entries = [];
        for (var i=0, l=$el.length; i<l; i++) {
            this.entries[i] = new Entry(this, $($el[i]));
        }
        
        // Bind key events
        var thisEntries = this;
        layout.keys.listen(KEY_N, KEY_J, function () { thisEntries.selectNext(); });
        layout.keys.listen(KEY_P, KEY_K, function () { thisEntries.selectPrevious(); });
        layout.keys.listen(KEY_V, KEY_RET, function () { thisEntries.clickCurrent(); });
    }
    
    Entries.prototype = $.extend(Entries.prototype, {
        // Page length for API requests
        pageLength: null,
        pkAvailable: null,
        
        loading: false,
        finished: false,
        pkLookup: null,
        pkLast: 0,
        
        current: null,
        $current: null,
        entryBottoms: null,
        
        handleScroll: function (top) {
            var newCurrent = -1;
            
            // Update selection if in expanded mode
            if (this.layout.displayMode == MODE_EXPANDED) {
                for (var i=0, l=this.entries.length; i<l; i++) {
                    if (this.entryBottoms[i] > top) {
                        newCurrent = i;
                        break;
                    }
                }
                if (newCurrent >= 0 && newCurrent != this.current) {
                    this.selectEntry(newCurrent);
                }
            }
        },
        loadInfiniteScroll: function (loadNumber) {
            /** Infinite scroll loader
                Called when it is time to load more entries
            */
            var thisEntries = this;
            
            // Don't do anything if:
            //  * there are no entries at all,
            //  * we're already trying to load more, or
            //  * there is no more to load
            if (this.entries.length === 0 || this.loading || this.finished) {
                return;
            }
            this.loading = true;
            
            // Build list of visible PKs
            var $entry, i, len = this.entries.length;
            for (i=this.pkLast; i<len; i++) {
                $entry = $(this.entries[i].$el);
                this.pkLookup[$entry.data('yarr-pk')] = $entry;
            }
            this.pkLast = this.entries.length;
            
            // Default loadNumber to pageLength - may be higher in list mode
            if (!loadNumber) {
                loadNumber = this.pageLength;
            }
            
            // Decide which pks to get next
            // ++ can be smarter here - use pkUnloaded
            var pkRequest = [];
            len = this.pkAvailable.length;
            for (i=0; i<len && pkRequest.length<loadNumber; i++) {
                if (!this.pkLookup[this.pkAvailable[i]]) {
                    pkRequest.push(this.pkAvailable[i]);
                }
            }
            
            if (pkRequest.length == 0) {
                Yarr.Status.set('No more entries to load');
                this.loading = false;
                this.finished = true;
                return;
            }
            
            // Get data for entries
            Yarr.Status.set('Loading...');
            Yarr.API.getEntries(
                pkRequest,
                function (entries) {
                    /** Entries loaded */
                    thisEntries.loading = false;
                    
                    // Catch no more entries
                    var count = entries.length;
                    if (count == 0) {
                        Yarr.Status.set('No more entries to load');
                        thisEntries.finished = true;
                        return;
                    }
                    
                    // Add HTML of entries
                    var $entries = [];
                    for (var i=0; i<count; i++) {
                        var $entry = $(entries[i].html).appendTo(thisEntries.layout.$content);
                        thisEntries.entries.push(new Entry(thisEntries, $entry));
                        $entries.push($entry);
                    }
                    
                    // Update $entries and recalc size
                    thisEntries.$entries.add($entries);
                    thisEntries.entriesResized();
                }, function () {
                    /** API list load: failure */
                    thisEntries.loading = false;
                }
            );
        },
        
        entriesResized: function () {
            /** Recalculate cached positions which depend on entry height
                Called when the entries have resized
            */
            
            // Cache the entry positions
            this.entryBottoms = [];
            var $el;
            for (var i=0, l=this.entries.length; i<l; i++) {
                $el = this.entries[i].$el;
                this.entryBottoms[i] = $el.offset().top + $el.outerHeight();
            }
            
            // Update the infinite scroll trigger
            this.layout.updateScrollTrigger();
        },
        
        selectEntry: function (index) {
            /** Select an entry */
            // Deselect current
            if (this.current !== null) {
                this.entries[this.current].$el.removeClass('yarr_active');
            }
            
            // Update current and get flag fields
            this.current = index;
            this.$current = this.entries[this.current].$el
                .addClass('yarr_active')
            ;
            
            // Open the selected item
            this.entries[this.current].open();
            
            // If this is the last entry, try to load more
            if (index == this.entries.length - 1) {
                this.loadInfiniteScroll();
            }
        },
        selectNext: function () {
            /** Select the next (or first) entry */
            var current = this.current;
            if (current === null) {
                // None selected, force the increment to pick -1
                current = -1;
            }
            if (current == this.entries.length - 1) {
                return;
            }
            this.selectEntry(current + 1);
            this.scrollCurrent();
        },
        
        selectPrevious: function () {
            /** Select previous, unless none or index 0 selected */
            if (!this.current) {
                return;
            }
            this.selectEntry(this.current - 1);
            this.scrollCurrent();
        },

        scrollCurrent: function () {
            /** Scroll to the current entry */
            this.layout.scrollTo(this.entries[this.current].$el.offset().top);
        },
        
        clickCurrent: function () {
            /** Clicks the link of the current entry to open it in a new tab */
            if (this.current === null) {
                return;
            }
            if (!this.$current.hasClass('yarr_active')) {
                return;
            }
            if (this.layout.displayMode == MODE_LIST
                && !this.$current.hasClass('yarr_open')
            ) {
                this.entries[this.current].open();
                return;
            }
            this.$current.find('a[class="yarr-link"]')[0].click();
        }
    });
    
    // ++ move Entry onto Yarr.Entry
    function Entry (entries, $el) {
        var thisEntry = this;
        this.entries = entries;
        this.$el = $el;
        this.index = $el.index();
        this.pk = $el.data('yarr-pk');
        
        // Detect state
        this.state = parseInt($el.data('yarr-state'), 10);
        this.read = this.state == ENTRY_READ;
        this.saved = this.state == ENTRY_SAVED;
        
        // Enhance entry with javascript
        this.setup();
        
        // Find elements and handle clicks
        this.$content = $el.find('.yarr_entry_content')
            .click(function (e) { return thisEntry.onContentClick(e); })
        ;
        this.$li = $el.find('.yarr_entry_li')
            .click(function (e) { return thisEntry.onListClick(e); })
        ;
    }
    Entry.prototype = $.extend(Entry.prototype, {
        setup: function () {
            /** Convert a static HTML entry to ajax-ready controls */
            var thisEntry = this;
            
            // Build toggle buttons
            this.$read = this._mkCheckbox('read', ENTRY_READ, this.read);
            this.$saved = this._mkCheckbox('saved', ENTRY_SAVED, this.saved);
            
            // Add buttons
            this.$el.find('.yarr_entry_control')
                .empty()
                .append(this._wrapCheckbox(this.$read, 'yarr_checkbox_read', 'Read'))
                .append(this._wrapCheckbox(this.$saved, 'yarr_checkbox_saved', 'Saved'))
            ;
            
            // When images load, update the position cache
            this.$el.find('img').load(function () {
                thisEntry.entries.entriesResized();
            });
        },
        changeState: function (state) {
            /** Handle a read/saved state checkbox change */
            if (state == ENTRY_READ) {
                if (this.read) {
                    this.markUnread();
                } else {
                    this.markRead();
                }
            } else if (state == ENTRY_SAVED) {
                if (this.saved) {
                    this.markRead();
                } else {
                    this.markSaved();
                }
            }
        },
        
        markUnread: function () {
            this._markSet(false, false, Yarr.API.unreadEntry);
        },
        markRead: function () {
            this._markSet(true, false, Yarr.API.readEntry);
        },
        markSaved: function () {
            this._markSet(false, true, Yarr.API.saveEntry);
        },
        _markSet: function (read, saved, api) {
            /** Set internal and call API */
            var thisEntry = this;
            this.read = read;
            this.saved = saved;
            this.$read.prop('checked', read);
            this.$saved.prop('checked', saved);
            this.$el
                .removeClass('yarr_read yarr_saved')
                .addClass(read ? 'yarr_read' : (saved ? 'yarr_saved' : ''))
            ;
            api(this, function (data) {
                thisEntry._markDone(data);
            });
        },
        _markDone: function (data) {
            /** After API success */
            // Update unread count in the feed list.
            var counts = data['feed_unread'];
            for (var pk in counts) {
                var count = counts[pk];
                this.entries.layout.$feedList
                    .find('[data-yarr-feed=' + pk + ']')
                    .each(function() {
                        $(this)
                            .toggleClass('yarr_feed_unread', count !== 0)
                            .find('.yarr_count_unread').text(count)
                        ;
                    })
                ;
            }
        },
        
        onListClick: function (e) {
            if (this.$el.hasClass('yarr_open')) {
                this.$el.removeClass('yarr_open');
            } else {
                this.entries.selectEntry(this.$el.index());
                // Since everything has shifted around we need to scroll to
                // a known position or the user will be lost.
                this.entries.scrollCurrent();
            }
        },
        onContentClick: function (e) {
            this.entries.selectEntry(this.index);
        },
        
        open: function () {
            /** Open the specified entry, marking it as read */
            // Open
            if (this.entries.layout.displayMode == MODE_LIST) {
                this.entries.$entries.removeClass('yarr_open');
                this.$el.addClass('yarr_open');
                this.entries.entriesResized();
            }
            
            // Mark as read if unread
            if (this.state == ENTRY_UNREAD) {
                this.markRead();
            }
        },
        
        /* Internal util fns */
        _mkCheckbox: function (name, state, value) {
            /** Build a checkbox */
            var thisEntry = this;
            return $('<input type="checkbox" name="' + name + '"/>')
                .prop('checked', value)
                .change(function () {
                    thisEntry.changeState(state);
                })
            ;
        },
        
        _wrapCheckbox: function ($box, cls, label) {
            /** Wrap a checkbox in a label */
            return $('<label><span>' + label + '</span></label>')
                .prepend($box)
                .wrap('<li />')
                .parent()
                .addClass(cls)
            ;
        }
    });
    
    
    
    /**************************************************************************
    **                                                     Bind event handlers
    */

    function KeyHandler($el) {
        var thisHandler = this;
        this.$el = $el
            .keydown(function (e) {
                thisHandler.handle(e);
            })
        ;
        this.registry = {};
    }
    KeyHandler.prototype = $.extend(KeyHandler.prototype, {
        listen: function () {
            /** Call a function when one or more keys is selected
                Last argument should be the function; example:
                    keys.listen(KEY_N, KEY_X, KEY_T, myfn);
            */
            var keys = Array.prototype.slice.call(arguments),
                fn = keys.pop()
            ;
            for (var i=0, l=keys.length; i<l; i++) {
                this.registry[keys[i]] = fn;
            }
        },
        handle: function (e) {
            if (e.ctrlKey) {
                return;
            }
            if (this.registry[e.which]) {
                e.preventDefault();
                this.registry[e.which]();
            }
        }
    });
    
    /**************************************************************************
    **                                                          Initialise
    */
    
    var layout = new Layout(options);
    
    
});
