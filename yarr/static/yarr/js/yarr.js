var YARR = (function () {
    /** Global YARR object
        Requires YARR_CONFIG
    */
    
    // Constants, must match server-side values
    var constants = {
        ENTRY_UNREAD:   0,
        ENTRY_READ:     1,
        ENTRY_SAVED:    2,
        ORDER_ASC:      'asc',
        ORDER_DESC:     'desc'
    };
    
    // Get config and apply defaults
    var config = window.YARR_CONFIG;
    if (!config) {
        return;
    }
    config = $.extend({}, {
        con:        'body'
    }, config);
    
    // Prep globals
    var Yarr = {
        constants:      constants,
        config:         config
    };
    
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
                Yarr.Status.set('API not available');
                return;
            }
            
            $.getJSON(root_url + api_call + '/', data)
                .done(function(json) {
                    Yarr.Status.set(json.msg, !json.success);
                    if (json.success) {
                        if (successFn) {
                            successFn(json);
                        }
                    } else if (failFn) {
                        failFn(json.msg);
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
            getFeed: function (feed, successFn, failFn) {
                Yarr.API.getFeeds([feed.pk], successFn, failFn);
            },
            getFeeds: function (feed_pks, successFn, failFn) {
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
            
            getFeedPks: function (feed, state, order, successFn, failFn) {
                Yarr.API.getFeedsPks([feed.pk], state, order, successFn, failFn);
            },
            getFeedsPks: function (feed_pks, state, order, successFn, failFn) {
                request(
                    'feed/pks', {
                        'feed_pks': feed_pks.join(','),
                        'state':    state,
                        'order':    order
                    },
                    function (json) {
                        if (successFn) {
                            successFn(json.pks);
                        }
                    }, failFn
                );
            },
            
            getEntry: function (entry, successFn, failFn) {
                Yarr.API.getEntries(
                    [entry.pk], constants.ORDER_DESC, successFn, failFn
                );
            },
            getEntries: function (entry_pks, order, successFn, failFn) {
                request(
                    'entry/get', {
                        'entry_pks': entry_pks.join(','),
                        'order': order
                    },
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
            },
            
            unreadEntry: function (entry, successFn, failFn) {
                Yarr.API.unreadEntries([entry.pk], successFn, failFn);
            },
            readEntry: function (entry, successFn, failFn) {
                Yarr.API.readEntries([entry.pk], successFn, failFn);
            },
            saveEntry: function (entry, successFn, failFn) {
                Yarr.API.saveEntries([entry.pk], successFn, failFn);
            },
            
            unreadEntries: function (entry_pks, successFn, failFn) {
                Yarr.API.setEntries(
                    entry_pks, constants.ENTRY_UNREAD, null, successFn, failFn
                );
            },
            readEntries: function (entry_pks, successFn, failFn) {
                Yarr.API.setEntries(
                    entry_pks, constants.ENTRY_READ, null, successFn, failFn
                );
            },
            saveEntries: function (entry_pks, successFn, failFn) {
                Yarr.API.setEntries(
                    entry_pks, constants.ENTRY_SAVED, null, successFn, failFn
                );
            },
            
            setEntries: function (entry_pks, state, if_state, successFn, failFn) {
                request('entry/set', {
                    'entry_pks': entry_pks.join(','),
                    'state':    state,
                    'if_state': if_state
                }, successFn, failFn);
            }
        };
    })();
    
    
    /** Feed object */
    Yarr.Feed = Yarr.multiton(function (pk) {
        this.pk = pk;
        this.loaded = false;
    });
    Yarr.Feed.prototype = $.extend(Yarr.Feed.prototype, {
        load: function (successFn, failFn) {
            /** Load feed data */
            if (this.loaded) {
                return successFn();
            }
            Yarr.API.getFeed(this, successFn, failFn);
        },
        toString: function () {
            return this.text || this.title || 'untitled';
        }
    });
    
    /** Entry object */
    Yarr.Entry = Yarr.multiton(function (pk) {
        this.pk = pk;
        this.loaded = false;
    });
    Yarr.Entry.prototype = $.extend(Yarr.Entry.prototype, {
        load: function (successFn, failFn) {
            /** Load entry data */
            if (this.loaded) {
                return successFn();
            }
            Yarr.API.getEntry(this, successFn, failFn);
        }
    });
    
    
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
