import $ from 'jquery';
import { ENTRY_UNREAD, ENTRY_READ, ENTRY_SAVED } from './utils/constants';
import { multiton } from './utils/multiton';
import { Status } from './components/status';


const config = {
  con: '.yarr',
  ...(window.YARR_CONFIG || {})
};

// Prep globals
export const Yarr = {
  status: new Status(),
  config: config
};

// Additional initialisation on DOM ready
$(function () {
  Yarr.el = {
    con: document.querySelector(config.con),
    control: document.querySelector(`${config.con} > .control`),
    body: document.querySelector(`${config.con} > .body`)
  };
  Yarr.$con = $(config.con);
  Yarr.status.con = Yarr.el.body;
});

/** API abstraction layer */
Yarr.API = (function () {
  var root_url = config.api,
    requestQueue = [],
    requesting = false
    ;

  function request(api_call, data, successFn, failFn) {
    if (!root_url) {
      Yarr.status.set('API not available', true);
      return;
    }

    if (requesting) {
      requestQueue.push([api_call, data, successFn, failFn]);
      return;
    }
    requesting = true;

    $.getJSON(root_url + api_call + '/', data)
      .done(function (json) {
        Yarr.status.set(json.msg, !json.success);
        if (json.success) {
          if (successFn) {
            successFn(json);
          }
        } else if (failFn) {
          failFn(json.msg);
        }
        nextRequest();
      })
      .fail(function (jqxhr, textStatus, error) {
        Yarr.status.set(textStatus + ': ' + error, true);
        if (failFn) {
          failFn(textStatus);
        }
        nextRequest();
      })
      ;
  }
  function nextRequest() {
    requesting = false;
    if (requestQueue.length === 0) {
      return;
    }
    request.apply(this, requestQueue.shift());
  }

  // Hash for faster lookup
  var dates = { 'last_checked': 1, 'last_updated': 1, 'next_check': 1 };
  return {
    getFeed: function (feed, successFn, failFn) {
      Yarr.API.getFeeds([feed.pk], successFn, failFn);
    },
    getFeeds: function (feed_pks, successFn, failFn) {
      request(
        'feed/get', { 'feed_pks': feed_pks.join(',') },
        function (json) {
          // Load data into Feed instances
          var pk, feed, feeds = [], key, data;
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
        'state': state,
        'order': order
      },
        function (json) {
          if (successFn) {
            successFn(json.pks, json.feed_unread);
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
          var pk, entry, entries = [], key, data;
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
        entry_pks, ENTRY_UNREAD, null, successFn, failFn
      );
    },
    readEntries: function (entry_pks, successFn, failFn) {
      Yarr.API.setEntries(
        entry_pks, ENTRY_READ, null, successFn, failFn
      );
    },
    saveEntries: function (entry_pks, successFn, failFn) {
      Yarr.API.setEntries(
        entry_pks, ENTRY_SAVED, null, successFn, failFn
      );
    },

    setEntries: function (entry_pks, state, if_state, successFn, failFn) {
      request('entry/set', {
        'entry_pks': entry_pks.join(','),
        'state': state,
        'if_state': if_state
      }, successFn, failFn);
    }
  };
})();


/** Feed object */
Yarr.Feed = multiton(function (pk) {
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
Yarr.Entry = multiton(function (pk) {
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
    for (var i = 0, pair; pair = pairs[i] && pairs[i].split('='); i++) {
      if (decodeURIComponent(pair[0]) === key) return pair[1];
    }
    return defaultValue;
  }
};
