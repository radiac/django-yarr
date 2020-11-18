$(function () {
    var Yarr = window.YARR;
    if (!Yarr) {
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
            thisRow.feed.load(function () {
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
                    ]);
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
        })
    ;
    
    // Add firefox loader
    (function () {
        var $feed_add = $('#yarr_feed_add');
        if (!navigator.registerContentHandler || $feed_add.length === 0) {
            return;
        }
        
        $('<p/>').append(
            $('<a href="#">Register with your browser</a>')
                .click(function (e) {
                    e.preventDefault();
                    url = window.location.origin
                        + $('#yarr_feed_add').attr('action')
                        + '?feed_url=%s'
                    ;
                    navigator.registerContentHandler(
                        "application/vnd.mozilla.maybe.feed",
                        url,
                        "Yarr"
                    );
                })
        ).insertAfter($feed_add);
    })();
    
});