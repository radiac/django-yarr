/** JavaScript for yarr list_entries
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
    
    var 
        /*
        ** Constants
        */
        ENTRY_UNREAD = Yarr.constants.ENTRY_UNREAD,
        ENTRY_READ = Yarr.constants.ENTRY_READ,
        ENTRY_SAVED = Yarr.constants.ENTRY_SAVED,
        
        MODE_EXPANDED = 'expanded',
        MODE_LIST = 'list',
        FEEDS_VISIBLE = 'visible',
        FEEDS_HIDDEN = 'hidden',
        
        // Key codes
        KEY_N = 78,
        KEY_P = 80,
        KEY_J = 74,
        KEY_K = 75,
        KEY_V = 86,
        KEY_RET = 13,
        
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
            displayMode: Yarr.Cookie.get('yarr-displayMode', MODE_EXPANDED),
            
            // Feed list visiblity; either visible or hidden, or null for CSS
            feedListShow: Yarr.Cookie.get('yarr-feedListShow', null),
            
            // Whether or not the control bar and feed list should be fixed
            layoutFixed: Yarr.config.layout_fixed,
        
            // Number of entries on a page
            pageLength: Yarr.config.api_page_length,
            
            // List of available pks
            pkAvailable: Yarr.config.available_pks,
            
            // Title control
            titleTemplate: Yarr.config.title_template,
            titleSelector: Yarr.config.title_selector,
            
            // Initial state, order and feed for this page
            initialState: Yarr.config.initial_state,
            initialOrder: Yarr.config.initial_order,
            initialFeed: Yarr.config.initial_feed
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
        this.state = options.initialState;
        this.order = options.initialOrder;
        this.displayMode = options.displayMode;
        this.layoutFixed = options.layoutFixed;
        
        // Find elements
        this.$control = $base.find('.yarr_control');
        this.$content = $base.find('.yarr_content');
        
        // Detect values using dummy elements
        var $dummyListItem = $('<div class="yarr_entry_li">&nbsp;</div>')
            .appendTo(this.$content)
        ;
        this.listItemHeight = $dummyListItem.outerHeight();
        $dummyListItem.remove();
        
        // Initialise related classes
        this.keys = new KeyHandler($base);
        this.feedList = new FeedList(this, $base.find('.yarr_feed_list'));
        this.entries = new Entries(this, $base.find('.yarr_entry'));
        
        // Set up control bar and fixed layout
        this.setupControl();
        if (this.layoutFixed) {
            this.fixLayout();
            this.feedList.fixLayout();
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
        state:  null,
        order:  null,
        displayMode: MODE_EXPANDED,
        layoutFixed: true,
        controlIsFixed: false,
        controlTop: null,
        controlBottom: null,
        scrollCutoff: null,
        entryMargin: null,
        
        // Height of an item when in list mode
        listItemHeight: 0,
        
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
            this.entryMargin = this.feedList.$el.offset().top - this.controlBottom;
        },
        fixLayout: function () {
            /** Prepare fixed layout */
            
            // Add feed switch and initialise
            var thisLayout = this;
            $('<ul class="yarr_menu_feed"/ >')
                .append($('<li/>').append(
                    this._mkButton('Feeds', function () {
                        thisLayout.feedList.toggle();
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
            this.loadScreen();
        },
        
        setTitle: function (feed) {
            var title = 'all items';
            if (this.state == ENTRY_UNREAD) {
                title = 'Unread items';
            } else if (this.state == ENTRY_SAVED) {
                title = 'Saved items';
            }
            
            if (feed) {
                title = feed + ' - ' + title;
            }
            
            if (this.options.titleSelector) {
                $(this.options.titleSelector).text(title);
            }
            if (this.options.titleTemplate) {
                document.title = this.options.titleTemplate.replace('%(feed)s', title);
            }
        },
        
        loadScreen: function() {
            /** Ensure that enough entries have loaded to fill the screen.
                Infinite scroll can't trigger without a full screen to scroll.
                
                In list mode, this will calculate how many entries to load
                based on the height of an unexpanded entry.
                
                In expanded mode, this will keep loading pages until the screen
                is full, or there is no more to load.
            */
            // Get the height from the bottom of the loaded entries to the
            // bottom of the viewport, plus the infinite scroll margin
            var gap = (
                (this.$scroller.innerHeight() + scrollInfiniteMargin)
                - (this.$content.offset().top + this.$content.outerHeight())
            );
            if (gap < 0) {
                return;
            }
            
            if (this.displayMode == MODE_LIST) {
                // If there's a gap, tell Entries to load enough entries to
                // exceed the infinite scroll margin
                this.entries.loadNext(Math.ceil(gap / this.listItemHeight));
                
            } else if (this.displayMode == MODE_EXPANDED) {
                var thisLayout = this;
                this.entries.loadNext(function () {
                    if (thisLayout.entries.pkUnloaded.length) {
                        thisLayout.loadScreen();
                    }
                })
            }
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
            this.loadScreen();
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
                        this.feedList.$el.css('top', this.$controlFixed.outerHeight());
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
                    this.feedList.$el.css('top', this.controlBottom - scrollTop);
                }
            }
            
            // Tell the entries to handle scrolling
            this.entries.handleScroll(topCutoff);
            
            // Infinite scroll
            if (scrollTop > this.scrollInfiniteTrigger) {
                this.entries.loadNext();
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
    
    function FeedList(layout, $el) {
        var thisFeedList = this;
        this.layout = layout;
        this.$el = $el;
        
        // Load options
        this.feedListShow = layout.options.feedListShow;
        
        // Detect values, using dummy elements where necessary
        var $dummyList = $('<div class="yarr_feed_list">&nbsp;</div>'),
            $dummyContent = $('<div class="yarr_content">&nbsp;</div>')
        ;
        this.defaultPosition = $dummyList.css('position');
        this.defaultWidth = $dummyList.width();
        this.contentMargin = $dummyContent.css('margin-left');
        this.isOpen = $el.is(":visible");
        
        // Find elements
        this.$feeds = $el.find('.yarr_feed_list_feeds');
        this.$viewAll = $el.find('.yarr_feed_menu .yarr_view_all')
            .click(function (e) {
                e.preventDefault();
                thisFeedList.selectFeed();
            })
        ;
        
        // Create Feeds from the items
        this.feeds = {};
        var $feedEls=this.$feeds.find('[data-yarr-feed]'),
            pk, $feedEl
        ;
        for (var i=0, l=$feedEls.length; i<l; i++) {
            $feedEl = $($feedEls[i]);
            pk = $feedEl.data('yarr-feed');
            this.feeds[pk] = Yarr.Feed.get(pk);
            this.feeds[pk].init(this, $feedEl);
        }
        
        // Find current feed
        if (layout.options.initialFeed) {
            this.current = Yarr.Feed.get(layout.options.initialFeed);
        } else {
            this.current = null;
        }
    }
    FeedList.prototype = $.extend(FeedList.prototype, {
        fixLayout: function () {
            // Prepare the fixed feedList
            this.$el.css({
                'position': 'fixed',
                'top':      this.layout.controlBottom,
                'bottom':   this.$el.css('margin-top')
            });
            this.$feeds.css({
                'position': 'absolute',
                'top':      this.$feeds.position().top,
                'bottom':   0
            });
            
            // Toggle the feed list visibility, if preference in cookies
            if (this.feedListShow) {
                this.toggle(this.feedListShow);
            }
        },
        toggle: function (to) {
            /** Toggle the visibility of the feed list
                Only available if layoutFixed
            */
            // Current state is determined by checking for element visibility
            // This allows the CSS to decide the default status with media rules
            var thisFeedList = this,
                speed = 'fast'
            ;
            
            // Check if the switch isn't needed
            if ((to == FEEDS_VISIBLE && this.isOpen)
                || (to == FEEDS_HIDDEN && !this.isOpen)
            ) {
                return;
            }
            this.isOpen = !this.isOpen;
            
            // Special action for mobile layout
            if (this.defaultPosition == 'relative') {
                if (this.isOpen) {
                    this.$el.slideDown(speed);
                } else {
                    this.$el.slideUp(speed, function () {
                        this.$el.removeAttr('style');
                    });
                }
                return;
            }
            
            // Normal sidebar layout
            if (this.isOpen) {
                this.$el
                    .show()
                    .animate({'width': this.defaultWidth}, function () {
                        thisFeedList.$el.removeAttr('style');
                    })
                ;
                this.layout.$content
                    .animate(
                        {'margin-left': this.contentMargin},
                        function () {
                            thisFeedList.layout.$content.removeAttr('style');
                        }
                    )
                ;
                
            } else {
                this.$el.animate({'width': 0}, speed, function () {
                    thisFeedList.$el.hide();
                });
                this.layout.$content.animate({'margin-left': 0}, speed);
            }
            
            // Save the current display configuration in a cookie
            // This will disable initial auto-sensing between screen sizes,
            this.feedListShow = this.isOpen ? FEEDS_HIDDEN : FEEDS_VISIBLE;
            Yarr.Cookie.set('yarr-feedListShow', this.feedListShow);
        },
        setUnread: function (pk, count) {
            /** Set the unread count for the feed given by pk */
            if (this.feeds[pk]) {
                this.feeds[pk].setUnread(count);
            }
        },
        selectFeed: function (feed) {
            /** Select the specified Feed
                To select all feeds, pass nothing or null
            */
            this.current = feed;
            
            // Tell the Layout to change the document and page titles
            layout.setTitle(feed);
            
            // Show or hide the "View all feeds" button
            this.$viewAll.toggle(!!feed);
            
            // Tell entries to load this feed
            this.layout.entries.loadFeed(feed);
        }
    });

    Yarr.Feed.prototype = $.extend(Yarr.Feed.prototype, {
        init: function (feedList, $el) {
            this.feedList = feedList;
            this.$el = $el;
            this.$unread = $el.find('.yarr_count_unread');
            this.hasUnread = parseInt(this.$unread.text(), 10) === 0;
            
            var thisFeed = this;
            this.text = this.$el.find('a')
                .click(function (e) {
                    e.preventDefault();
                    feedList.selectFeed(thisFeed);
                })
                .text()
            ;
        },
        setUnread: function (count) {
            this.$el.toggleClass('yarr_feed_unread', count !== 0);
            this.$unread.text(count);
        }
    });
    
    
    function Entries(layout, $el) {
        this.layout = layout;
        this.$entries = $el;
        
        // Options
        this.pageLength = layout.options.pageLength;
        
        // Initialise Entry classes
        this.entries = [];
        var pkAvailable = layout.options.pkAvailable,
            foundPks = {},
            entry,
            i, l = $el.length
        ;
        for (i=0; i<l; i++) {
            entry = this.entryFromHtml($($el[i]));
            foundPks[entry.pk] = true;
        }
        
        // Generate list of unloaded pks
        l = pkAvailable.length;
        this.pkUnloaded = [];
        for (i=0; i<l; i++) {
            if (!foundPks[pkAvailable[i]]) {
                this.pkUnloaded.push(pkAvailable[i]);
            }
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
        
        // List of unread pks
        pkUnloaded: null,
        
        // Keep track of async requests to allow blocking and superceding
        loading: false,
        loadId: 0,
        
        current: null,
        $current: null,
        entryBottoms: null,
        
        entryFromHtml: function ($el) {
            /** Create an Entry from HTML */
            var entry = Yarr.Entry.get($el.data('yarr-pk'));
            entry.init(this, $el);
            this.entries.push(entry);
            return entry;
        },
        
        loadFeed: function (feed) {
            /** Discard the current entries and load the entries from the Feed
                To load all feeds, pass null or undefined
            */
            if (feed) {
                Yarr.Status.set('Loading feed...');
            } else {
                Yarr.Status.set('Loading all feeds...');
            }
            
            // This feed load takes priority over any previous load
            this.loading = true;
            var thisEntries = this,
                loadId = ++this.loadId,
                feed_pks = feed ? [feed.pk] : []
            ;
            Yarr.API.getFeedsPks(
                feed_pks,
                this.layout.state,
                this.layout.order,
                function (pks) {
                    if (loadId < thisEntries.loadId) {
                        return;
                    }
                    thisEntries.loadPks(pks);
                    thisEntries.loading = false;
                },
                function () {
                    thisEntries.loading = false;
                }
            );
        },
        loadPks: function (pks) {
            /** Change the available pks to those specified
                Discard the current entries and load enough entries from the
                new pks to fill a page
            */
            Yarr.Status.set('Loading entries...');
            this.pkUnloaded = pks;
            
            // Remove entries
            this.entries = [];
            this.$entries.remove();
            this.$entries = $();
            
            // Reset all other vars
            this.loading = false;
            
            // Load a screen full of entries
            this.layout.loadScreen();
        },
        
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
        loadNext: function (loadNumber, successFn) {
            /** Load next page of entries, if possible
            
                Arguments:
                    loadNumber  Number of entries to load
                                Defaults to page length, API_PAGE_LENGTH
                    isMore      Boolean to determine whether this is a
                                first load, or an infinite load for more
            */
            // Don't do anything if already loading, or nothing more to load
            if (this.loading || this.pkUnloaded.length === 0) {
                return;
            }
            
            // Check if just sent successFn
            if (typeof(loadNumber) == "function") {
                successFn = loadNumber;
                loadNumber = null;
            }
            
            var thisEntries = this,
                loadId = ++this.loadId,
                isMore = (this.entries.length !== 0)
            ;
            this.loading = true;
            
            
            // Default loadNumber to pageLength - may be higher in list mode
            if (!loadNumber) {
                loadNumber = this.pageLength;
            }
            
            // Decide which pks to get next
            var num = Math.min(this.pkUnloaded.length, loadNumber),
                pkRequest = this.pkUnloaded.slice(0, num)
            ;
            this.pkUnloaded = this.pkUnloaded.slice(num);
            
            // If there is nothing to request, handle correctly
            if (pkRequest.length === 0) {
                if (isMore) {
                    Yarr.Status.set('No more entries to load');
                } else {
                    Yarr.Status.set('Feed is empty');
                    var state = thisEntries.layout;
                    thisEntries.$entries = $('<p/>')
                        .text(
                            'No' + (
                                (state == ENTRY_UNREAD) ? ' unread' :
                                (state == ENTRY_SAVED) ? ' saved' : ''
                            ) + ' items'
                        )
                        .appendTo(thisEntries.layout.$content)
                    ;
                }
                return;
            }
            
            // Get data for entries
            Yarr.Status.set('Loading...');
            Yarr.API.getEntries(
                pkRequest,
                this.layout.order,
                function (entries) {
                    /** Entries loaded */
                    // Check this load call hasn't been superseded
                    if (loadId < thisEntries.loadId) {
                        return;
                    }
                    thisEntries.loading = false;
                    
                    // Add HTML of entries
                    for (var i=0, l=entries.length; i<l; i++) {
                        var $entry = $(entries[i].html)
                            .appendTo(thisEntries.layout.$content)
                        ;
                        thisEntries.entryFromHtml($entry);
                        thisEntries.$entries = thisEntries.$entries.add($entry);
                    }
                    
                    // Recalc size
                    thisEntries.entriesResized();
                    if (successFn) {
                        successFn();
                    }
                    
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
                this.loadNext();
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
    
    Yarr.Entry.prototype = $.extend(Yarr.Entry.prototype, {
        init: function (entries, $el) {
            var thisEntry = this;
            this.entries = entries;
            this.$el = $el;
            this.index = $el.index();
            this.pk = $el.data('yarr-pk');
            this.feed = Yarr.Feed.get($el.data('yarr-feed'));
            
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
        },
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
                this.entries.layout.feedList.setUnread(pk, count);
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
    **                                                          Key handler
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
