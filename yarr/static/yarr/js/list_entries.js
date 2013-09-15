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
        ** Internal vars
        */
        OP_READ = 'read',
        OP_SAVED = 'saved',
        MODE_EXPANDED = 'expanded',
        MODE_LIST = 'list',
        FEEDS_VISIBLE = 'visible',
        FEEDS_HIDDEN = 'hidden',
        
        $scroller = $(window),
        $control = $('.yarr_control'),
        $content = $('.yarr_content'),
        $entries = $('.yarr_entry'),
        $feedList = $('.yarr_feed_list'),
        pkAvailable = String($con.data('available-pks')),
        apiEntrySet = $con.data('api-entry-set'),
        
        $controlFixed, controlIsFixed = false,
        controlTop, controlHeight, controlBottom,
        scrollCutoff, entryBottoms, entryMargin, scrollInfiniteTrigger,
        infiniteLoading = false, infiniteFinished = false,
        current, $current,
        
        
        /*
        ** Settings
        */
        
        // Display mode; one of:
        //      expanded    Traditional list of titles and bodies
        //      list        List of titles, with expanding bodies
        displayMode = Yarr.Cookie.get('yarr-displayMode', MODE_EXPANDED),

        // Feed list visiblity; either visible or hidden, or undefined for CSS
        feedListShow = Yarr.Cookie.get('yarr-feedListShow', undefined),
        
        // Switch items when scrolling past this point
        scrollSwitchMargin = 100,
        
        // Load more entries for infinite scroll when this many pixels left
        scrollInfiniteMargin = 300,
        
        // Page length for API requests
        pageLength = $con.data('api-page-length'),
        
        // Whether or not the control bar and feed list should be fixed
        layoutFixed = !!$con.data('layout-fixed')
    ;
    
    // Split pkAvailable
    if (pkAvailable == '') {
        pkAvailable = [];
    } else {
        pkAvailable = pkAvailable.split(',');
    }
    
    
    /**************************************************************************
    **                                                          Functions
    */

    
    function mkButton(txt, fn) {
        return $('<a href="#" class="button">' + txt + '</a>')
            .click(function (e) {
                e.preventDefault();
                fn();
            })
        ;
    }
    function mkIconButton(className, fn) {
        return $('<a href="#" class="' + className + '">&nbsp;</a>')
            .click(function (e) {
                e.preventDefault();
                fn();
            })
        ;
    }
    
    function switchMode(newMode) {
        /** Switch display mode between expanded and list view */
        
        // Switch the mode
        if (newMode == MODE_LIST) {
            $content.addClass('yarr_mode_list');
            $('.yarr_menu_mode a').text('Expanded view');
        } else {
            $content.removeClass('yarr_mode_list');
            $('.yarr_menu_mode a').text('List view');
        }
        
        // Update var and cookie
        displayMode = newMode;
        Yarr.Cookie.set('yarr-displayMode', displayMode);
        
        // Scroll to the top
        $scroller.scrollTop(0);
        
        // Ensure full screen
        ensureFullScreen();
    }
    
    function toggleFeed(to) {
        /** Toggle the visibility of the feed; only available if layoutFixed */
        // Current state is determined by checking for element visibility
        // This allows the CSS to decide the default status with media rules
        var speed = 'fast',
            isOpen = $feedList.is(":visible"),
            
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
                $feedList.slideUp(speed, function () {
                    $feedList.removeAttr('style');
                });
            } else {
                $feedList.slideDown(speed);
            }
            return;
        }
        
        // Normal sidebar layout
        if (isOpen) {
            $feedList.animate({'width': 0}, speed, function () {
                $feedList.hide();
            });
            $content.animate({'margin-left': 0}, speed);
            
        } else {
            var $dummyContent = $('<div class="yarr_content">&nbsp;</div>');
            
            $feedList
                .show()
                .animate({'width': $dummyList.width()}, function () {
                    $feedList.removeAttr('style');
                })
            ;
            $content
                .animate(
                    {'margin-left': $dummyContent.css('margin-left')},
                    function () {
                        $content.removeAttr('style');
                    }
                );
        }
        
        // Save the current display configuration in a cookie
        // This will disable initial auto-sensing between screen sizes,
        feedListShow = isOpen ? FEEDS_HIDDEN : FEEDS_VISIBLE;
        Yarr.Cookie.set('yarr-feedListShow', feedListShow);
    }
    
    function setupControl() {
        /** Remove pagination links, add scroll buttons, and clone fixed bar */
        
        // Infinite scroll support, so disable pagination links
        $control.find('.yarr_paginated').remove();
        
        // Add mode switch and initialise
        $('<ul class="yarr_menu_mode" />')
            .append($('<li/>').append(
                mkButton('Mode', function () {
                    switchMode(
                        (displayMode == MODE_LIST)
                        ? MODE_EXPANDED : MODE_LIST
                    );
                })
            ))
            .insertAfter($control.find('.yarr_menu_op'))
        ;
        switchMode(displayMode);
        
        // Add next/prev buttons
        $('<ul class="yarr_nav"/>')
            .append($('<li/>').append(
                mkIconButton('yarr_previous', selectPrevious)
            ))
            .append(' ')
            .append($('<li/>').append(
                mkIconButton('yarr_next', selectNext)
            ))
            .appendTo($control)
        ;
        
        // Calculate entry margin for autoscrolling
        controlBottom = $control.offset().top + $control.outerHeight();
        entryMargin = $feedList.offset().top - controlBottom;
        
        // Prepare fixed layout
        if (layoutFixed) {
            // Add feed switch and initialise
            $('<ul class="yarr_menu_feed"/ >')
                .append($('<li/>').append(
                    mkButton('Feeds', toggleFeed)
                ))
                .insertBefore($control.find('.yarr_menu_filter'))
            ;
            
            // Clone control bar ready for fixed position
            // Need to clone so the original can stay in position
            $controlFixed = $control
                .clone(true)
                .insertAfter($control)
                .css({
                    'position': 'fixed',
                    'top':      0
                })
                .hide()
            ;
            
            // Prepare the fixed feedList
            $feedList.css({
                'top':      controlBottom,
                'bottom':   $feedList.css('margin-top'),
            });
            
            // Toggle the feed list visibility, if preference in cookies
            if (feedListShow) {
                toggleFeed(feedListShow);
            }
        }
    }
    
    function mkCheckbox($entry, name) {
        /** Build a checkbox */
        return $('<input type="checkbox" name="' + name + '"/>')
            .prop('checked', $entry.data('yarr-' + name))
        ;
    }
    
    function wrapCheckbox($box, label) {
        /** Wrap a checkbox in a label */
        return $('<label>' + label + '</label>')
            .prepend($box)
            .wrap('<li />')
            .parent()
        ;
    }
    
    function setupEntry($entry) {
        /** Convert a static HTML entry to ajax-ready controls */
        
        // Build toggle buttons
        var $read = mkCheckbox($entry, 'read'),
            $saved = mkCheckbox($entry, 'saved')
        ;
        
        // Add handlers
        $read
            .add($saved)
            .change(function () {
                var $box = $(this),
                    op = ($box.get(0) == $read.get(0)) ? OP_READ : OP_SAVED,
                    state = $box.prop('checked'),
                    $other = (op == OP_READ) ? $saved : $read,
                    data
                ;
                
                // If true, the other field must be false
                if (state) {
                    $other.prop('checked', false);
                }
                $entry.attr('data-yarr-read', $read.prop('checked'));
                
                // Prep data
                data = {
                    'entry_pks': [$entry.data('yarr-pk')].join(','),
                    'op':       op,
                    'is_read':  $read.prop('checked'),
                    'is_saved': $saved.prop('checked')
                }
                
                // Update class
                if ($read.prop('checked')) {
                    $entry.addClass('yarr_read');
                } else {
                    $entry.removeClass('yarr_read');
                }
                
                // Update the server
                apiCall(apiEntrySet, data);
            })
        ;
        
        // Add buttons
        $entry.find('.yarr_entry_control')
            .empty()
            .append(wrapCheckbox($read, 'Read'))
            .append(wrapCheckbox($saved, 'Saved'))
        ;
        
        // When images load, update the position cache
        $entry.find('img').load(entriesResized);
    }
    
    function apiCall(url, data, successFn, failFn) {
        if (!url) {
            Yarr.Status.set('API disabled');
            return;
        }
        
        /** Make a call to the API */
        $.getJSON(url, data)
            .done(function(json) {
                Yarr.Status.set(json.msg, !json.success);
                if (successFn) {
                    successFn(json);
                }
            })
            .fail(function(jqxhr, textStatus, error ) {
                Yarr.Status.set(textStatus + ': ' + error, true);
                if (failFn) {
                    failFn(textStatus);
                }
            })
        ;
    }
    
    function selectEntry(index) {
        /** Select an entry */
        
        // Deselect current
        if (current !== undefined) {
            $($entries.get(current)).removeClass('yarr_active');
        }
        
        // Update current and get flag fields
        current = index;
        $current = $($entries.get(current))
            .addClass('yarr_active')
        ;
        
        // Open the selected item
        openCurrent();
        
        // If this is the last entry, try to load more
        if (index == $entries.length - 1) {
            loadInfiniteScroll();
        }
    }
    
    function selectNext() {
        /** Select the next (or first) entry */
        if (current === undefined) {
            current = -1;
        }
        if (current == $entries.length - 1) {
            return;
        }
        selectEntry(current + 1);
        scrollCurrent();
    }
    
    function selectPrevious() {
        /** Select previous, unless none or index 0 selected */
        if (!current) {
            return;
        }
        selectEntry(current - 1);
        scrollCurrent();
    }

    function scrollCurrent() {
        /** Scroll to the current entry */
        $scroller.scrollTop(
            ($($entries.get(current)).offset().top - $control.outerHeight())
            - entryMargin
        );
    }
    
    function openCurrent() {
        /** Open the specified entry, marking it as read */
        var $read = $current.find('input[name="read"]'),
            $saved = $current.find('input[name="saved"]')
        ;
        if (!$saved.prop('checked') && !$read.prop('checked')) {
            $read
                .prop('checked', true)
                .change()
            ;
        }
        
        if (displayMode == MODE_LIST) {
            $entries.removeClass('yarr_open');
            $current.addClass('yarr_open');
            entriesResized();
        }
    }

    function clickCurrent() {
        /** Clicks the link of the current entry to open it in a new tab */
        if (current == undefined) {
            return;
        }
        if (!$current.hasClass('yarr_active')) {
            return;
        }
        if (displayMode == MODE_LIST && !$current.hasClass('yarr_open')) {
            return;
        }
        $current.find('a[class="yarr-link"]')[0].click();
    }

        
    
    function ensureFullScreen() {
        /** Ensure that enough entries have loaded to fill the screen, if more
            are available.
            
            Infinite scroll can't trigger without a full screen to scroll.
        */
        
        // Only in list mode
        if (displayMode != MODE_LIST) {
            return;
        }
        
        // Get the height from the bottom of the loaded entries to the bottom
        // of the viewport, plus the infinite scroll margin
        var gap = (
            ($scroller.innerHeight() + scrollInfiniteMargin)
            - ($content.offset().top + $content.outerHeight())
        );
        
        // If there's already no gap or no entries at all, nothing more to do
        if (gap < 0 || $entries.length == 0) {
            return;
        }
        
        // Tell loadInfiniteScroll to load enough entries to exceed the
        // infinite scroll margin
        loadInfiniteScroll(Math.ceil(gap / $entries.outerHeight()));
    }
    
    function loadInfiniteScroll(loadNumber) {
        /** Infinite scroll loader
            Called when it is time to load more entries
        */
        
        // Don't do anything if we're already trying to load more, or there is
        // no more to load
        if (infiniteLoading || infiniteFinished) {
            return;
        }
        infiniteLoading = true;
        
        // Build list of visible PKs
        // ++ move pk_lookup outside into cached global
        var pkLookup = {}, $el;
        for (var i=0, l=$entries.length; i<l; i++) {
            $el = $($entries[i]);
            pkLookup[$el.data('yarr-pk')] = $el;
        }
        
        // Default loadNumber to pageLength - may be higher in list mdoe
        if (!loadNumber) {
            loadNumber = pageLength;
        }
        
        // Decide which pks to get next
        // ++ can be smarter here - use pkUnloaded
        var pkRequest = [];
        for (
            var i=0, l=pkAvailable.length;
            i<l && pkRequest.length<loadNumber;
            i++
        ) {
            if (!pkLookup[pkAvailable[i]]) {
                pkRequest.push(pkAvailable[i]);
            }
        }
        
        if (pkRequest.length == 0) {
            Yarr.Status.set('No more entries to load');
            infiniteLoading = false;
            infiniteFinished = true;
            return;
        }
        
        // Get data for entries
        Yarr.Status.set('Loading...');
        Yarr.API.get_entries(
            pkRequest,
            function (entries) {
                /** Entries loaded */
                infiniteLoading = false;
                
                // Catch no more entries
                var count = entries.length;
                if (count == 0) {
                    Yarr.Status.set('No more entries to load');
                    infiniteFinished = true;
                    return;
                }
                
                // Add HTML of entries
                for (var i=0; i<count; i++) {
                    var $entry = $(entries[i].html).appendTo($content);
                    setupEntry($entry);
                }
                
                // Update $entries and recalc size
                $entries = $('.yarr_entry');
                entriesResized();
            }, function () {
                /** API list load: failure */
                infiniteLoading = false;
            }
        );
    }
    
    function entriesResized() {
        /** Recalculate cached positions which depend on entry height
            Called when the entries have resized
        */
        
        // Cache the entry positions
        entryBottoms = [];
        var $el;
        for (var i=0, l=$entries.length; i<l; i++) {
            $el = $($entries[i]);
            entryBottoms[i] = $el.offset().top + $el.outerHeight();
        }
        
        // Update the infinite scroll trigger
        scrollInfiniteTrigger = $content.outerHeight()
            + $content.position().top
            - $scroller.innerHeight() - scrollInfiniteMargin
        ;
    }
    
    
    
    /**************************************************************************
    **                                                          Initialise
    */
    
    // Set up the control bar
    setupControl();
    
    // Set up all entries and select the first one
    $entries
        .each(function () {
            setupEntry($(this));
        })
    ;
    
    
    
    
    /**************************************************************************
    **                                                     Bind event handlers
    */
    
    // Handle entry clicks
    $content
        .on('click', '.yarr_entry_content', function (e) {
            selectEntry($(this).parent().index());
            scrollCurrent();
        })
        .on('click', '.yarr_entry_li', function (e) {
            var $entry = $(this).parent();
            if ($entry.hasClass('yarr_open')) {
                $entry.removeClass('yarr_open');
            } else {
                selectEntry($entry.index());
            }
        })
    ;
    
    
    // Handle screen resizes
    $scroller.resize(function () {
        /** Event handler for when the scroller resizes
            Updates the fixed control bar position, and calls entriesResized
        */
        // Get position of $control
        var controlOffset = $control.offset();
        
        // Find position of controlTop and scrollCutoff (may have changed)
        controlTop = controlOffset.top;
        controlHeight = $control.outerHeight();
        scrollCutoff = controlHeight + scrollSwitchMargin;
        
        // Move $controlFixed to occupy same horizontal position as $control
        if (layoutFixed) {
            $controlFixed.css({
                left:   controlOffset.left,
                width:  $control.width()
            });
        }
        
        // The entries will have resized
        entriesResized();
        ensureFullScreen();
    }).resize();
    
    // Handle scrolling
    $scroller.scroll(function () {
        /** Event handler for scrolling */
        var scrollTop = $scroller.scrollTop(),
            newCurrent = -1,
            topCutoff = scrollTop + scrollCutoff,
            topMoved = false
        ;
        
        // Switch control bar between fixed and relative position
        if (layoutFixed) {
            if (scrollTop > controlTop) {
                // Fixed layout
                // Only change if changed
                if (!controlIsFixed) {
                    // Switch control bar to fixed position
                    $controlFixed.show();
                    controlIsFixed = true;
                    
                    // Move feed list to bottom of fixed bar
                    $feedList.css('top', $controlFixed.outerHeight());
                }
                
            } else {
                // Relative layout
                // Only switch bars if changed
                if (controlIsFixed) {
                    // Switch control bar to relative position
                    $controlFixed.hide();
                    controlIsFixed = false;
                }
                
                // Always move feed list to bottom of relative bar
                $feedList.css('top', controlBottom - scrollTop);
            }
        }
        
        // Update selection if in expanded mode
        if (displayMode == MODE_EXPANDED) {
            for (var i=0, l=$entries.length; i<l; i++) {
                if (entryBottoms[i] > topCutoff) {
                    newCurrent = i;
                    break;
                }
            }
            if (newCurrent >= 0 && newCurrent != current) {
                selectEntry(newCurrent);
            }
        }
        
        // Infinite scroll
        if (scrollTop > scrollInfiniteTrigger) {
            loadInfiniteScroll();
        }
    });
    
    // Key presses
    var KEY_N = 78,
        KEY_P = 80,
        KEY_J = 74,
        KEY_K = 75,
        KEY_V = 86,
        KEY_RET = 13
    ;
    $('body').keydown(function (e) {
        /** Event handler for keypresses */
        if (e.which == KEY_N || e.which == KEY_J) {
            selectNext();
        } else if (e.which == KEY_P || e.which == KEY_K) {
            selectPrevious();
        } else if (e.which == KEY_V || e.which == KEY_RET) {
            clickCurrent();
        } else {
            return;
        }
        e.preventDefault();
    });
});
