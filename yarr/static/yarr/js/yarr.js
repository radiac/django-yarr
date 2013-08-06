var YARR = (function () {
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
    var Yarr = {};
    
    // Additional initialisation on DOM ready
    $(function () {
        Yarr.$con = $(config.con);
    });
    
    
    /** Multiton class factory
        Turns a class constructor into a Multiton
        
        Call with an abstract class constructor
        Returns the constructor with a new .get() object method
        To get or create instance of class, call .get() with arguments;
        must pass at least one argument, which must be the key.
        All arguments are then passed on to the constructor.
    */
    Yarr.multiton = function(cls) {
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
        };
        return cls;
    };
    
    /** Status popup handler */
    Yarr.Status = (function () {
        var $status, statusTimeout;
        
        return {
            set: function (msg, is_error) {
                /** Display a message in the status popup */
                
                // Create the status now rather than within constructor
                // Allows pages to override $con
                if (!$status) {
                    console.log('adding status', Yarr.$con);
                    $status = $('<div id="yarr_status" />')
                        .appendTo(Yarr.$con)
                        .hide()
                    ;
                }
                
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
        };
    })();
    
    /** API abstraction layer */
    Yarr.API = (function () {
        var root_url = config.api;
        function request(api_call, data, successFn, failFn) {
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
                        var pk, feed, feeds=[], key, data;
                        for (pk in json.feeds) {
                            data = json.feeds[pk];
                            feed = Yarr.Feed.get(pk);
                            for (key in data) {
                                if (data[key] && key in dates) {
                                    data[key] = new Date(data[key]);
                                }
                                feed[key] = data[key];
                            }
                            feed.loaded = true;
                            feeds.push(feed);
                        }
                        if (successFn) {
                            successFn(feeds);
                        }
                    }, failFn
                );
            },
            get_entry: function (entry, successFn, failFn) {
                Yarr.API.get_entries([entry.pk], successFn, failFn);
            },
            get_entries: function (entry_pks, successFn, failFn) {
                request(
                    'entry/get', {'entry_pks': entry_pks.join(',')},
                    function (json) {
                        // Load data into Entry instances
                        var pk, entry, entries=[], key, data;
                        for (pk in json.entries) {
                            data = json.entries[pk];
                            entry = Yarr.Entry.get(pk);
                            entry.feed = Yarr.Feed.get(data.feed_pk);
                            delete data.feed_pk;
                            for (key in data) {
                                entry[key] = data[key];
                            }
                            entry.loaded = true;
                            entries.push(entry);
                        }
                        if (successFn) {
                            successFn(entries);
                        }
                    }, failFn
                );
            }
        };
    })();
    
    
    /** Feed object */
    Yarr.Feed = Yarr.multiton(function (pk) {
        this.pk = pk;
        this.loaded = false;
    });
    Yarr.Feed.prototype = {
        load: function (successFn, failFn) {
            /** Load feed data */
            if (this.loaded) {
                return successFn();
            }
            Yarr.API.get_feed(this, successFn, failFn);
        }
    };
    
    /** Entry object */
    Yarr.Entry = Yarr.multiton(function (pk) {
        this.pk = pk;
        this.loaded = false;
    });
    Yarr.Entry.prototype = {
        load: function (successFn, failFn) {
            /** Load entry data */
            if (this.loaded) {
                return successFn();
            }
            Yarr.API.get_entry(this, successFn, failFn);
        }
    };
    
    
    /** Cookie management */
    Yarr.Cookie = {
        set: function (key, value) {
            /** Set the cookie */
            var expires = new Date();
            expires.setDate(expires.getDate() + 3650);
            document.cookie = [
                encodeURIComponent(key), '=', value,
                '; expires=' + expires.toUTCString(),
                '; path=/',
                (window.location.protocol == 'https:') ? '; secure' : ''
            ].join('');
        },
        get: function (key, defaultValue) {
            /** Get all cookies */
            var pairs = document.cookie.split('; ');
            for (var i=0, pair; pair = pairs[i] && pairs[i].split('='); i++) {
                if (decodeURIComponent(pair[0]) === key) return pair[1];
            }
            return defaultValue;
        }
    };
    
    return Yarr;
})();
