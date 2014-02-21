/** JavaScript for yarr list_entries */

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
            initialFeed: Yarr.config.initial_feed,
            
            // URLs for building history
            urlAll: Yarr.config.url_all,
            urlFeed: Yarr.config.url_feed
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
        this.urlAll = options.urlAll;
        this.urlFeed = options.urlFeed;
        
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
            // Set up the feed list with initial visibility preference
            this.feedList.fixLayout();
            if (this.feedList.feedListShow) {
                this.feedList.toggle(this.feedList.feedListShow);
            }
        }
        var thisLayout = this;
        this.$scroller
            .resize(function () { thisLayout.onResize(); })
            .scroll(function () { thisLayout.onScroll(); })
        ;
        
        // Find margin between the control bar and the first entry
        this.controlMargin = parseInt(this.feedList.$el.css('margin-top'), 10);
        
        // Trigger a resize
        this.onResize();
        
        // Initialse history with current state
        this.history = new History(this);
    }
    Layout.prototype = $.extend(Layout.prototype, {
        // Settings from options
        options: null,
        state:  null,
        order:  null,
        displayMode: MODE_EXPANDED,
        layoutFixed: true,
        controlIsFixed: false,
        
        // Control position and bottom margin
        controlTop: null,
        controlBottom: null,
        controlMargin: null,
        
        scrollCutoff: null,
        
        // Height of an item when in list mode
        listItemHeight: 0,
        
        // Control bar menu and nav lists
        $menu: null,
        $nav: null,
        
        // Title of current page
        title: '',
        
        setupControl: function () {
            /** Set up top control bar for JavaScript management */
            var thisLayout = this;
            
            // Remove all existing buttons
            this.$control.empty();
            
            // Build new menu list
            this.$menu = $('<ul class="yarr_menu">')
                .appendTo(this.$control)
            ;
            
            // Build feed settings dropdown
            var $addFeed = this.feedList.$el.find('.yarr_add_feed'),
                $manageFeeds = this.feedList.$el.find('.yarr_manage_feeds')
            ;
            this.settingsDropDown = new DropDown(
                [
                    [$addFeed.text(), $addFeed.attr('href'), true],
                    [$manageFeeds.text(), $manageFeeds.attr('href'), true]
                ]
            );
            $addFeed.add($manageFeeds).parent().remove();
            this.settingsDropDown.setLabel(
                '<span class="yarr_button_settings" title="Settings">&nbsp;</span>'
            );
            this.$menu.append(this.settingsDropDown.asLi());
            
            // Add mode switch menu
            this.settingsDropDown.addMenu(
                'mode',
                [
                    ['Expanded view', MODE_EXPANDED],
                    ['List view', MODE_LIST]
                ],
                function (value) {
                    thisLayout.switchMode(value);
                },
                this.displayMode
            );
            this.switchMode(this.displayMode);
            
            // Add ordering 
            this.settingsDropDown.addMenu(
                'order',
                [
                    ['Newest first', Yarr.constants.ORDER_DESC],
                    ['Oldest first', Yarr.constants.ORDER_ASC]
                ],
                function (value) {
                    thisLayout.setOrder(value);
                },
                this.order
            );
            
            // Build state dropdown
            this.stateDropDown = new DropDown(
                [
                    ['All items', null],
                    ['Unread items', ENTRY_UNREAD],
                    ['Saved items', ENTRY_SAVED]
                ],
                function (state) {
                    if (state == thisLayout.state) {
                        return;
                    }
                    thisLayout.state = state;
                    thisLayout.feedList.selectFeed(thisLayout.feedList.current);
                },
                this.state
            );
            this.$menu.append(this.stateDropDown.asLi());
            
            // Mark all as read
            this.allReadButton = new IconButton(
                'Mark all read', 'yarr_button_all_read',
                function () {
                    return thisLayout.entries.markAllRead();
                }
            );
            this.$menu.append(this.allReadButton.asLi());
            this.toggleAllRead();
            
            
            // Add next/prev buttons
            this.$nav = $('<ul class="yarr_nav"/>')
                .append(
                    (new IconButton(
                        'Previous;', 'yarr_previous',
                        function () {
                            return thisLayout.entries.selectPrevious();
                        }
                    )).asLi()
                )
                .append(
                    (new IconButton(
                        'Next', 'yarr_next',
                        function () {
                            return thisLayout.entries.selectNext();
                        }
                    )).asLi()
                )
                .appendTo(this.$control)
            ;
        },
        fixLayout: function () {
            /** Prepare fixed layout */
            
            // Add feed switch and initialise
            var thisLayout = this;
            this.$menu.prepend(
                (new IconButton('Feeds', 'yarr_button_feeds',
                    function () {
                        thisLayout.feedList.toggle();
                    })
                ).asLi()
            );
            
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
            
            // Bind dropdowns to new buttons
            this.settingsDropDown.addEl(
                $(this.$controlFixed.find('.yarr_menu > li')[
                    this.settingsDropDown.$el.parent().index()
                ]).find('a')
            );
            this.stateDropDown.addEl(
                $(this.$controlFixed.find('.yarr_menu > li')[
                    this.stateDropDown.$el.parent().index()
                ]).find('a')
            );
        },
        switchMode: function (newMode) {
            /** Switch display mode between expanded and list view */
            
            // Switch the mode
            if (newMode == MODE_LIST) {
                this.$content.addClass('yarr_mode_list');
            } else {
                this.$content.removeClass('yarr_mode_list');
            }
            
            // Update var and cookie
            this.displayMode = newMode;
            Yarr.Cookie.set('yarr-displayMode', newMode);
            
            // Scroll to the top
            this.$scroller.scrollTop(0);
            
            // Ensure full screen
            this.loadScreen();
        },
        setOrder: function (order) {
            if (order == this.order) {
                return;
            }
            this.order = order;
            this.entries.reload();
        },
        updateTitle: function () {
            // Build the title string
            var title = 'All items';
            if (this.state == ENTRY_UNREAD) {
                title = 'Unread items';
            } else if (this.state == ENTRY_SAVED) {
                title = 'Saved items';
            }
            if (this.feedList.current) {
                title = this.feedList.current + ' - ' + title;
            }
            
            // Store
            this.title = title;
            
            // Update window and body titles
            if (this.options.titleSelector) {
                $(this.options.titleSelector).text(title);
            }
            if (this.options.titleTemplate) {
                document.title = this.options.titleTemplate.replace(
                    '%(feed)s', title
                );
            }
        },
        toggleAllRead: function () {
            /** Toggle visibility of the mark all read button */
            var fl = this.feedList,
                count = fl.current ? fl.current.unread : fl.totalUnread
            ;
            this.allReadButton.$el.toggle(count !== 0);
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
            var $last = this.entries.$entries.last(),
                gap = (this.$scroller.innerHeight() + scrollInfiniteMargin) - (
                    $last.length ? (
                        $last.offset().top + $last.outerHeight()
                    ) : 0
                )
            ;
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
            var ctrlHeight = (
                this.controlIsFixed ? this.$controlFixed : this.$control
            ).outerHeight();
            
            this.$scroller.scrollTop(
                (y - ctrlHeight) - this.controlMargin
            );
        },
        
        lockLayout: function () {
            /** Opportunity to lock the layout when in fixed mode
                Called before the content element resizes
                Used to keep fixed bar in position
            */
            if (!this.layoutFixed || !this.controlIsFixed) {
                return;
            }
            this.$content.css('min-height', this.feedList.$el.height());
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
            this.controlBottom = controlOffset.top + controlHeight;
            this.scrollCutoff = controlHeight + scrollSwitchMargin;
            
            // Move $controlFixed to occupy same horizontal position as $control
            if (this.layoutFixed) {
                this.$controlFixed.css({
                    left:   controlOffset.left,
                    width:  this.$control.width()
                });
                
                // Reset the content height
                this.$content.css('min-height', 'auto');
            }
            
            // Update feedlist
            this.feedList.resized();
            
            // The entries will have resized
            this.entries.entriesResized();
            this.loadScreen();
            
            // May have affected scroll position
            this.onScroll(true);
        },
    
        onScroll: function (force) {
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
                    if (force || !this.controlIsFixed) {
                        // Switch control bar to fixed position
                        this.$controlFixed.show();
                        this.controlIsFixed = true;
                        
                        // Move feed list to bottom of fixed bar
                        this.feedList.$el.css('top', this.$controlFixed.outerHeight());
                    }
                    
                } else {
                    // Relative layout
                    // Only switch bars if changed
                    if (force || this.controlIsFixed) {
                        // Switch control bar to relative position
                        this.$controlFixed.hide();
                        this.controlIsFixed = false;
                    }
                    
                    // Always move feed list to bottom of relative bar
                    this.feedList.$el.css('top', this.controlBottom - scrollTop);
                }
            }
            
            // Tell the entries to handle scrolling
            this.entries.focusScroll(topCutoff);
            
            // Infinite scroll
            if (scrollTop > this.scrollInfiniteTrigger) {
                this.entries.loadScroll();
            }
        }
    });
    
    
    function FeedList(layout, $el) {
        var thisFeedList = this;
        this.layout = layout;
        this.$el = $el;
        
        // Load options
        this.feedListShow = layout.options.feedListShow;
        
        // Detect values
        this.updatePositions();
        
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
            pk, feed, $feedEl
        ;
        for (var i=0, l=$feedEls.length; i<l; i++) {
            $feedEl = $($feedEls[i]);
            pk = $feedEl.data('yarr-feed');
            feed = this.feeds[pk] = Yarr.Feed.get(pk);
            feed.init(this, $feedEl);
            this.totalUnread += feed.unread;
        }
        
        // Find current feed
        if (layout.options.initialFeed) {
            this.current = Yarr.Feed.get(layout.options.initialFeed);
        } else {
            this.current = null;
        }
    }
    FeedList.prototype = $.extend(FeedList.prototype, {
        // The y offset for the absolute-positioned feeds menu
        feedsOffset: null,
        
        // Total unread count
        totalUnread: 0,
        
        updatePositions: function () {
            // Detect values using dummy elements
            var $dummyList = $('<div class="yarr_feed_list">&nbsp;</div>')
                    .css('display', 'block')
                    .insertAfter(this.$el),
                $dummyContent = $('<div class="yarr_content">&nbsp;</div>')
                    .insertAfter(this.layout.$content)
            ;
            this.defaultPosition = $dummyList.css('position');
            this.defaultWidth = $dummyList.width();
            this.contentMargin = $dummyContent.css('margin-left');
            $dummyList.remove();
            $dummyContent.remove();
            
            // Detect state
            this.isOpen = this.$el.is(":visible");
            this.isNarrow = (this.defaultPosition == 'relative');
        },
        fixLayout: function () {
            // Prepare the fixed feedList
            this.$el.css({
                'position': 'fixed',
                'top':      this.layout.controlBottom,
                'bottom':   this.$el.css('margin-top')
            });
            if (!this.feedsOffset) {
                this.feedsOffset = this.$feeds.position().top;
            }
            this.$feeds.css({
                'position': 'absolute',
                'top':      this.feedsOffset,
                'bottom':   0
            });
        },
        resized: function () {
            this.updatePositions();
            if (this.layout.layoutFixed) {
                this.fixLayout();
                
                if (this.isOpen && !this.isNarrow) {
                    this.$el.css('width', this.defaultWidth);
                    this.layout.$content.css('margin-left', this.contentMargin);
                } else {
                    this.$el.css('width', 0);
                    this.layout.$content.css('margin-left', 0);
                }
            }
        },
        toggle: function (to) {
            /** Toggle the visibility of the feed list
                Only available if layoutFixed
            */
            if (!this.layout.layoutFixed) {
                return;
            }
            
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
            if (this.isNarrow) {
                if (this.isOpen) {
                    this.$el.slideDown(speed);
                } else {
                    this.$el.slideUp(speed);
                }
                return;
            }
            
            // Normal sidebar layout
            if (this.isOpen) {
                this.$el
                    .show()
                    .animate({'width': this.defaultWidth})
                ;
                this.layout.$content
                    .animate({'margin-left': this.contentMargin})
                ;
                
            } else {
                this.$el.animate({'width': 0}, speed, function () {
                    thisFeedList.$el.hide();
                });
                this.layout.$content.animate({'margin-left': 0}, speed);
            }
            
            // Save the current display configuration in a cookie
            // This will disable initial auto-sensing between screen sizes,
            this.feedListShow = this.isOpen ? FEEDS_VISIBLE : FEEDS_HIDDEN;
            Yarr.Cookie.set('yarr-feedListShow', this.feedListShow);
        },
        setUnreadBulk: function (counts) {
            /** Update feed unread counts
                Expects an object of {pk:count, ...}
            */
            for (var pk in counts) {
                this.setUnread(pk, counts[pk]);
            }
        },
        setUnread: function (pk, count) {
            /** Set the unread count for the feed given by pk */
            if (!this.feeds[pk]) {
                return;
            }
            
            // Update the total count
            this.totalUnread += count - this.feeds[pk];
            
            // Update the feed
            this.feeds[pk].setUnread(count);
            
            // Toggle visibility of the mark unread button
            this.layout.toggleAllRead();
        },
        selectFeedPk: function (feed_pk) {
            /** Look up a feed pk and pass it to selectFeed
            */
            this.selectFeed(feed_pk ? this.feeds[feed_pk] : null);
        },
        selectFeed: function (feed) {
            /** Select the specified Feed
                To select all feeds, pass nothing or null
            */
            this.current = feed;
            
            // Hide bar if in narrow screen mode
            if (this.isNarrow) {
                this.toggle(FEEDS_HIDDEN);
            }
            
            // Tell the Layout to change the document and page titles
            this.layout.updateTitle();
            
            // Update the history
            this.layout.history.push();
            
            // Tell entries to load this feed
            this.layout.entries.loadFeed(feed);
            this.layout.toggleAllRead();
        }
    });

    Yarr.Feed.prototype = $.extend(Yarr.Feed.prototype, {
        init: function (feedList, $el) {
            this.feedList = feedList;
            this.$el = $el;
            this.$unread = $el.find('.yarr_count_unread');
            this.unread = parseInt(this.$unread.text(), 10);
            
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
            this.unread = count;
        },
        getUrl: function () {
            return this.feedList.layout.urlFeed[this.feedList.layout.state]
                .replace('/00/', '/' + this.pk + '/')
            ;
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
        
        // List of pks for this view not yet loaded
        pkUnloaded: null,
        
        // Keep track of async requests to allow blocking and superceding
        loading: false,
        loadId: 0,
        
        // Currently selected entry
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
        
        reload: function () {
            /** Reload the current feed */
            this.loadFeed(this.layout.feedList.current);
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
                function (pks, feed_unread) {
                    if (loadId < thisEntries.loadId) {
                        return;
                    }
                    thisEntries.loadPks(pks);
                    thisEntries.layout.feedList.setUnreadBulk(feed_unread);
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
            
            // Give layout opportunity to force min-height of content
            this.layout.lockLayout();
            
            // Remove entries
            this.entries = [];
            this.$entries.remove();
            this.$entries = $();
            this.current = null;
            
            // Reset all other vars
            this.loading = false;
            
            // Load a screen full of entries
            this.layout.loadScreen();
        },
        
        focusScroll: function (top) {
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
        
        loadScroll: function () {
            // This may be called as a result of wiping the entries
            // If there are no entries, ignore this event
            if (this.$entries.length === 0) {
                return;
            }
            this.loadNext();
        },
        
        loadNext: function (loadNumber, successFn) {
            /** Load next page of entries, if possible
            
                Arguments:
                    loadNumber  Number of entries to load
                                Defaults to page length, API_PAGE_LENGTH
                    isMore      Boolean to determine whether this is a
                                first load, or an infinite load for more
            */
            var thisEntries = this,
                isMore = (this.entries.length !== 0)
            ;
            
            // If already loading, abort
            if (this.loading) {
                return;
            }
            
            // If nothing more to load, report and abort
            if (this.pkUnloaded.length === 0) {
                if (isMore) {
                    Yarr.Status.set('No more entries to load');
                } else {
                    var msg = 'No' + (
                        (this.layout.state == ENTRY_UNREAD) ? ' unread' :
                        (this.layout.state == ENTRY_SAVED) ? ' saved' : ''
                    ) + ' items'
                    Yarr.Status.set(msg);
                    thisEntries.$entries = $('<p/>')
                        .text(msg)
                        .appendTo(thisEntries.layout.$content.empty())
                    ;
                }
                return;
            }
            
            // Check if just sent successFn
            if (typeof(loadNumber) == "function") {
                successFn = loadNumber;
                loadNumber = null;
            }
            
            var loadId = ++this.loadId;
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
            
            // Would be weird to get here with nothing to request, but
            // handle it just in case
            if (pkRequest.length === 0) {
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
        },
        
        markAllRead: function () {
            /** Mark all unread entries as read */
            // Get all PKs for this view - both loaded and unloaded
            var thisEntries = this,
                pks = [].concat(this.pkUnloaded),
                fkAPI = function (entry, fn) {},
                i, l=this.entries.length, entry
            ;
            for (i=0; i<l; i++) {
                pks.push(this.entries[i].pk);
            }
            
            // Call API and set them all to read, if state currently unread
            // Tell the feedlist to update returned unread counts
            Yarr.API.setEntries(pks, ENTRY_READ, ENTRY_UNREAD, function (data) {
                thisEntries.layout.feedList.setUnreadBulk(data['feed_unread']);
                
                // Update visible unread entries
                for (i=0; i<l; i++) {
                    entry = thisEntries.entries[i];
                    if (entry.state == ENTRY_UNREAD) {
                        // Call _markSet without an API call - already done
                        entry._markSet(ENTRY_READ, null);
                    }
                }
            });
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
            this.$read = this._mkCheckbox('read', ENTRY_READ, this.isRead());
            this.$saved = this._mkCheckbox('saved', ENTRY_SAVED, this.isSaved());
            
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
                if (this.isRead()) {
                    this.markUnread();
                } else {
                    this.markRead();
                }
            } else if (state == ENTRY_SAVED) {
                if (this.isSaved()) {
                    this.markRead();
                } else {
                    this.markSaved();
                }
            }
        },
        isRead: function () {
            return this.state == ENTRY_READ;
        },
        isSaved: function () {
            return this.state == ENTRY_SAVED;
        },
        
        markUnread: function () {
            this._markSet(ENTRY_UNREAD, Yarr.API.unreadEntry);
        },
        markRead: function () {
            this._markSet(ENTRY_READ, Yarr.API.readEntry);
        },
        markSaved: function () {
            this._markSet(ENTRY_SAVED, Yarr.API.saveEntry);
        },
        _markSet: function (state, api) {
            /** Set internal and call API */
            var thisEntry = this;
            
            // Update state and flags
            this.state = state;
            this.$read.prop('checked', this.isRead());
            this.$saved.prop('checked', this.isSaved());
            this.$el
                .removeClass('yarr_read yarr_saved')
                .addClass(
                    this.isRead() ? 'yarr_read' : (this.isSaved() ? 'yarr_saved' : '')
                )
            ;
            if (api) {
                api(this, function (data) {
                    thisEntry._markDone(data);
                });
            }
        },
        _markDone: function (data) {
            /** After API success */
            // Update unread count in the feed list.
            this.entries.layout.feedList.setUnreadBulk(data['feed_unread']);
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
            this.entries.selectEntry(this.$el.index());
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
    **                                                          History manager
    */
    
    function History(layout) {
        this.layout = layout;
        this.can = (window.history && window.history.pushState);
        if (!this.can) {
            return;
        }
        
        // Register listener
        var thisHistory = this;
        $(window).on('popstate', function (e) {
            thisHistory._pop(e.originalEvent.state);
        });
        
        // Register current state
        this._setHistory('replaceState');
    }
    
    History.prototype = $.extend(History.prototype, {
        // History is active if performing an action from history
        active: false,
        last_url: null,
        push: function () {
            if (!this.can) {
                return;
            }
            this._setHistory('pushState');
        },
        _setHistory: function (fnName) {
            // Only add to history if this is not popping history state
            if (this.active) {
                this.active = false;
                return;
            }
            
            // Look up data
            var feed = this.layout.feedList.current,
                state = {
                    feed_pk: feed ? feed.pk : null,
                    layout_state: this.layout.state
                },
                url = (
                    feed ? feed.getUrl()
                    : this.layout.urlAll[this.layout.state]
                )
            ;
            
            // Only add to history if url is changing
            if (url == this.last_url) {
                return;
            }
            history[fnName](state, this.layout.title, url);
            this.last_url = url;
        },
        _pop: function (state) {
            this.active = true;
            
            // Change the layout state
            this.layout.state = state.layout_state;
            
            // Select the feed
            this.layout.feedList.selectFeedPk(state.feed_pk);
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
    **                                                          UI classes
    */
    
    function Button(label, className, fn) {
        this.label = label;
        this.className = className || 'button';
        this.clickFn = fn;
        var thisButton = this;
        this.$el = $(
            '<a href="#" class="' + this.className + '">' + this.label + '</a>'
        )
            .click(function (e) {
                e.preventDefault();
                thisButton.clickFn(e);
            })
        ;
    }
    Button.prototype = $.extend(Button.prototype, {
        setLabel: function (label) {
            this.label = label;
            this.$el.html(label);
        },
        asLi: function () {
            return $('<li/>').append(this.$el);
        }
    });
    
    function IconButton(title, className, fn) {
        Button.call(this, '&nbsp;', className, fn);
        this.setLabel(title);
    }
    IconButton.prototype = $.extend(new Button(), IconButton.prototype, {
        setLabel: function (label) {
            this.$el.attr('title', label);
        }
    });
    
    function Menu(options, fn, current) {
        /**
            options     List of tuples
                            [label, value, valueIsHref]
                        If valueIsHref, will be a straight link,
                        otherwise will try to call fn arg
            fn          Function to call if option not an href
                        [label, value]  ->  fn(value, label)
            current     Current value (undefined for no current value)
        */
        var thisMenu = this;
        this.options = options;
        this.selectFn = fn;
        
        this.$options = $();
        for (var i=0, $a; i<options.length; i++) {
            if (options[i][2]) {
                $a = $('<a href="' + options[i][1] + '">' + options[i][0] + '</a>');
            } else {
                $a = $('<a href="#">' + options[i][0] + '</a>').click(
                    function (e) {
                        e.preventDefault();
                        thisMenu.select($(this).parent().index());
                    }
                );
            }
            this.$options = this.$options.add($a);
        }
        if (current !== undefined) {
            this.setValue(current);
        }
    }
    Menu.prototype = $.extend(Menu.prototype, {
        setValue: function (value) {
            this.value = value;
            for (var i=0; i<this.options.length; i++) {
                if (this.options[i][1] == value) {
                    this.render(i);
                    return this.options[i][0];
                }
            }
        },
        select: function (index) {
            this.render(index);
            this.value = this.options[index][1];
            this.selectFn(this.value, this.options[index][0]);
        },
        render: function (index) {
            this.$options.removeClass('yarr_selected');
            $(this.$options[index]).addClass('yarr_selected');
        },
        asUl: function () {
            var $ul = $('<ul/>');
            for (var i=0, l=this.$options.length; i<l; i++) {
                $ul.append(
                    $('<li/>').append($(this.$options[i]))
                );
            }
            return $ul;
        }
    });
    
    function DropDown(options, fn, current) {
        var thisDd = this;
        this.isOpen = false;
        
        // Event handler to detect click outside our dropdown
        this.detectClick = function (e) {
            // If clicked element is our button, take no action here
            if (thisDd.$el.is(e.target) || thisDd.$el.has(e.target).length) {
                return;
            }
            thisDd.close();
        };
        
        // Create button
        Button.call(this, '', 'yarr_dropdown', function (e) {
            if (!thisDd.isOpen) {
                thisDd.open($(e.currentTarget));
            } else {
                thisDd.close();
            }
        });
        
        // Create menu element
        this.$menu = $('<div class="yarr_dropdown_menu"/>');
        this.added = false;
        
        this.menus = {};
        this.addMenu(null, options, fn);
        this.defaultMenu = this.menus[null];
        if (current !== undefined) {
            this.setValue(current);
        }
    }
    DropDown.prototype = $.extend(new Button(), DropDown.prototype, {
        addMenu: function (id, options, fn, current) {
            var thisDd = this;
            var menu = new Menu(options, function (value, label) {
                if (menu == thisDd.defaultMenu) {
                    thisDd.setLabel(label);
                }
                fn(value, label);
            }, current);
            this.menus[id] = menu;
            this.$menu.append(menu.asUl());
        },
        addEl: function ($el) {
            /** Add button element which can trigger this dropdown */
            this.$el = this.$el.add($el);
        },  
        setValue: function (value) {
            this.value = value;
            var label = this.defaultMenu.setValue(value);
            this.setLabel(label);
        },
        open: function ($el) {
            if (!$el) {
                $el = this.$el;
            }
            this.isOpen = true;
            if (!this.added) {
                this.$menu.appendTo($('body'));
                this.added = true;
            }
            var buttonPos = $el.offset();
            this.$menu.css({
                'top':  buttonPos.top + $el.outerHeight() - 1,
                'left': buttonPos.left
            }).show();
            $(document).on('click', this.detectClick);
        },
        close: function () {
            this.isOpen = false;
            this.$menu.hide();
            $(document).off('click', this.detectClick);
        }
    });
    
    
    /**************************************************************************
    **                                                          Initialise
    */
    var layout = new Layout(options);
});
