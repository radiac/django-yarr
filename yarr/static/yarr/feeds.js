YARR = (function () {
    /** Global YARR object
        Requires YARR_CONFIG
    */
    
    // Get config and apply defaults
    var config = window.YARR_CONFIG;
    if (!config) {
        return;
    }
    config = $.extend({}, {
        con:        'body'
    }, config);
    
    // Prep globals
    var Yarr = {},
        $con = $(config.con)
    ;
    
    Yarr.multiton = function(cls) {
        /** Multiton class factory
            Turns a class constructor into a Multiton
            
            Call with an abstract class constructor
            Returns the constructor with a new .get() object method
            To get or create instance of class, call .get() with arguments;
            must pass at least one argument, which must be the key.
            All arguments are then passed on to the constructor.
        */
        // Somewhere to store instances
        var registry = {};

        // A wrapper class to pass arbitrary arguments on to the constructor
        function Cls(args) {
            return cls.apply(this, args);
        }
        
        cls.get = function (key) {
            // Copy across prototype in case it has changed
            Cls.prototype = cls.prototype;
            
            // Instantiate if necessary
            if (!(key in registry)) {
                registry[key] = new Cls(arguments);
            }
            return registry[key];
        }
        return cls;
    };
    
    Yarr.Status = (function () {
        var
            $status = $('<div id="yarr_status" />')
                .appendTo($con)
                .hide()
            ,
            statusTimeout
        ;
        
        return {
            set: function (msg, is_error) {
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
        }
    })();
    
    Yarr.API = (function () {
        var root_url = config.api;
        function request (api_call, data, successFn, failFn) {
            if (!root_url) {
                Yarr.Status.set('API disabled');
                return;
            }
            
            $.getJSON(root_url + api_call + '/', data)
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
        // Hash for faster lookup
        var dates = {'last_checked': 1, 'last_updated': 1, 'next_check': 1};
        return {
            get_feed: function (feed, successFn, failFn) {
                Yarr.API.get_feeds([feed.pk], successFn, failFn);
            },
            get_feeds: function (feed_pks, successFn, failFn) {
                request(
                    'feed/get', {'feed_pks': feed_pks.join(',')},
                    function (json) {
                        // Load data into Feed instances
                        var pk, feed, key, data;
                        for (pk in json.feeds) {
                            feed = Yarr.Feed.get(pk);
                            data = json.feeds[pk];
                            for (key in data) {
                                if (data[key] && key in dates) {
                                    data[key] = new Date(data[key]);
                                }
                                feed[key] = data[key];
                            }
                            feed.loaded = true;
                        }
                        if (successFn) {
                            successFn(json);
                        }
                    }, failFn
                );
            }
        };
    })();
    
    Yarr.Feed = Yarr.multiton(function (pk) {
        this.pk = pk;
        this.loaded = false;
    });
    Yarr.Feed.prototype = {
        load: function (successFn, failFn) {
            /** Load feed data */
            var thisFeed = this;
            Yarr.API.get_feed(this, successFn, failFn);
        }
    };
    
    return Yarr;
})();

$(function () {
    var Yarr = window.YARR;
    if (!Yarr) {
        console.log('fail2');
        return;
    }
    
    var Row = Yarr.multiton(function (pk, $el) {
        this.$el = $el;
        this.isOpen = false;
        
        // Set feed data - stored in row data for now
        var feed = this.feed = Yarr.Feed.get(pk);
        
        // Build row
        this.$content = $('<div/>').hide();
        this.$row = $('<tr class="yarr_feed_info"/>')
            .append(
                $('<td colspan="' + $el.children().length + '"/>')
                    .append(this.$content)
            )
            .insertAfter($el)
            .hide()
        ;
    });
    Row.prototype = {
        open: function () {
            var thisRow = this;
            thisRow.$row.show();
            thisRow.$content.html('<p>Loading...</p>').slideDown();
            thisRow.feed.load(function (json) {
                /** Render feed data as a data list */
                var feed = thisRow.feed, parts = [
                    ['Last checked', feed.last_checked],
                    ['Last updated', feed.last_updated],
                    ['Next check', feed.next_check]
                ];
                if (feed.site_url) {
                    parts.unshift([
                        'Website',
                        '<a href="' + feed.site_url + '" target="_blank">'
                        + feed.site_url + '</a>'
                    ])
                }
                if (feed.error) {
                    parts.push(['Problem', feed.error + '</dd><dd>'
                        + (feed.is_active
                            ? 'The feed is still being checked'
                            : 'The feed is no longer being checked'
                        )
                    ]);
                }
                
                out = '<dl>';
                for (var i=0; i<parts.length; i++) {
                    if (parts[i][1]) {
                        out += '<dt>' + parts[i][0] + '</dt><dd>'
                            + parts[i][1] + '</dd>'
                        ;
                    }
                }
                out += '</dl>';
                
                thisRow.$content.html(out);
            });
        },
        close: function () {
            var thisRow = this;
            thisRow.$content.slideUp(function () {
                thisRow.$row.hide();
            });
        },
        toggle: function () {
            (this.isOpen) ? this.close() : this.open();
            this.isOpen = !this.isOpen;
        }
    };
    
    
    // Listen to row clicks
    $('table.yarr_feed_manage tr')
        .click(function (e) {
            // Don't intercept clicks on links
            if ($(e.target).is('a')) {
                return;
            }
            
            // Toggle the row
            e.preventDefault();
            var $row = $(this);
            Row.get($row.data('yarr-pk'), $row).toggle();
        });
    ;
    
});