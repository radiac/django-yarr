$(function () {
    
    /**************************************************************************
    **                                                          Declare vars
    */
    var 
        /*
        ** Internal vars
        */
        OP_READ = 1,
        OP_SAVED = 2,
        $scroller = $(window),
        $con = $('#yarr_con'),
        $control = $('.yarr_control'),
        $content = $('#yarr_content'),
        $entries = $('.yarr_entry'),
        $status = $('<div id="yarr_status" />')
            .appendTo($con)
            .hide()
        ,
        apiEntry = $con.data('api-entry'),
        apiList = $con.data('api-list'),
        statusTimeout,
        $controlFixed, controlTop, controlHeight,
        scrollCutoff, entryBottoms, scrollInfiniteTrigger,
        infiniteLoading = false,
        current, $current,
        
        
        /*
        ** Settings
        */
        
        // Switch items when scrolling past this point
        scrollSwitchMargin = 100,
        
        // Load more entries for infinite scroll when this many pixels left
        scrollInfiniteMargin = 300,
        
        // Whether or not the control bar should be fixed when scrolling
        controlFixed = $control.data('fixed', true)
    ;
    
    
    /**************************************************************************
    **                                                          Functions
    */
    
    function mkIconButton(className, fn) {
        return $('<a href="#" class="' + className + '">&nbsp;</a>')
            .click(function (e) {
                e.preventDefault();
                fn();
            })
        ;
    }
    
    function setupControl() {
        /** Remove pagination links, add scroll buttons, and clone fixed bar */
        
        // Infinite scroll support, so disable pagination links
        $control.find('.yarr_paginated').remove();
        
        // Add next/prev buttons
        $('<ul class="yarr_nav"/>')
            .append(
                $('<li/>').append(
                    mkIconButton('yarr_previous', selectPrevious)
                )
            )
            .append(' ')
            .append(
                $('<li/>').append(
                    mkIconButton('yarr_next', selectNext)
                )
            )
            .appendTo($control)
        ;
    
        // Clone control bar ready for fixed position
        // Need to clone so the original can stay in position
        if (controlFixed) {
            $controlFixed = $control
                .clone(true)
                .insertAfter($control)
                .css({
                    'position': 'fixed',
                    'top':      0
                })
                .hide()
            ;
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
                    'entry_pk': $entry.data('yarr-pk'),
                    'is_read':  $read.prop('checked'),
                    'is_saved': $saved.prop('checked'),
                    'op':   (op == OP_READ) ? 'read' : 'saved'
                }
                
                // Update the server
                apiCall(apiEntry, data);
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
    
    function setStatus(msg, is_error) {
        /** Display a message in the status popup */
        clearTimeout(statusTimeout);
        if (!msg) {
            $status.hide();
            return;
        }
        
        $status.text(msg).show();
        if (is_error) {
            $status.addClass('yarr_error');
        } else {
            $status.removeClass('yarr_error');
        }
        
        statusTimeout = setTimeout(function () {
            $status.fadeOut();
        }, 5000);
    }
    
    function apiCall(url, data, successFn, failFn) {
        if (!url) {
            setStatus('API disabled');
            return;
        }
        
        /** Make a call to the API */
        $.getJSON(url, data)
            .done(function(json) {
                setStatus(json.msg, !json.status);
                
                if (successFn) {
                    successFn(json);
                }
            })
            .fail(function(jqxhr, textStatus, error ) {
                setStatus(textStatus + ', ' + error, true);
                if (failFn) {
                    failFn(json);
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
        var $read = $current.find('input[name="read"]'),
            $saved = $current.find('input[name="saved"]')
        ;
        
        // Try to mark as read
        if (!$saved.prop('checked') && !$read.prop('checked')) {
            $read
                .prop('checked', true)
                .change()
            ;
        }
        
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
            $($entries.get(current)).offset().top - $control.outerHeight()
        );
    }
    
    
    function loadInfiniteScroll() {
        /** Infinite scroll loader
            Called when it is time to load more entries
        */
        
        // Build list of visible PKs
        var pks = [], $el;
        for (var i=0, l=$entries.length; i<l; i++) {
            $el = $($entries[i]);
            pks.push($el.data('yarr-pk'));
        }
        if (infiniteLoading) {
            return;
        }
        infiniteLoading = true;
        
        // Get a new list
        setStatus('Loading...');
        apiCall(apiList, {
            'feed_pk':  $con.data('q-feedpk'),
            'saved':    $con.data('q-saved'),
            'unread':   $con.data('q-unread'),
            'pks':      pks.join(',')
        }, function (json) {
            /** API list load: success */
            
            // Catch no more entries
            var count = json.entries.length;
            if (count == 0) {
                setStatus('No more entries to load');
                return;
            }
            
            // Add entries
            for (var i=0; i<json.entries.length; i++) {
                var $entry = $(json.entries[i]).appendTo($content);
                setupEntry($entry);
            }
            infiniteLoading = false;
            
            // Update $entries and recalc size
            $entries = $('.yarr_entry');
            entriesResized();
            
        }, function () {
            /** API list load: failure */
            infiniteLoading = false;
        });
        
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
        .find('.yarr_entry_content')
            .click(function (e) {
                selectEntry($(this).parent().index());
                scrollCurrent();
            })
    ;
    
    
    
    /**************************************************************************
    **                                                     Bind event handlers
    */
    
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
        if (controlFixed) {
            $controlFixed.css({
                left:   controlOffset.left,
                width:  $control.width()
            });
        }
        
        // The entries will have resized
        entriesResized();
    }).resize();
    
    // Handle scrolling
    $scroller.scroll(function () {
        /** Event handler for scrolling */
        var scrollTop = $scroller.scrollTop(),
            newCurrent = -1,
            topCutoff = scrollTop + scrollCutoff
        ;
        
        // Switch control bar between fixed and relative position
        if (controlFixed) {
            if (scrollTop > controlTop) {
                // Fixed position
                $controlFixed.show();
                
            } else {
                // Relative position
                $controlFixed.hide();
            }
        }
        
        // Update selection
        for (var i=0, l=$entries.length; i<l; i++) {
            if (entryBottoms[i] > topCutoff) {
                newCurrent = i;
                break;
            }
        }
        if (newCurrent >= 0 && newCurrent != current) {
            selectEntry(newCurrent);
            
        }
        
        // Infinite scroll
        if (scrollTop > scrollInfiniteTrigger) {
            loadInfiniteScroll();
        }
    });
    
    // Key presses
    var KEY_N = 'N'.charCodeAt(0),
        KEY_P = 'P'.charCodeAt(0),
        KEY_J = 'J'.charCodeAt(0),
        KEY_K = 'K'.charCodeAt(0)
    ;
    $('body').keydown(function (e) {
        /** Event handler for keypresses */
        if (e.which == KEY_N || e.which == KEY_J) {
            selectNext();
            
        } else if (e.which == KEY_P || e.which == KEY_K) {
            selectPrevious();
        }
    });
});
