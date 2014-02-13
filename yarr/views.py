from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.core.urlresolvers import reverse
from django.db import models as django_models
from django.http import HttpResponseRedirect, Http404, HttpResponse
from django.shortcuts import get_object_or_404, render
from django.template import loader, Context
from django.utils.html import escape

from yarr import constants, settings, utils, models, forms
from yarr.constants import (
    ENTRY_UNREAD, ENTRY_READ, ENTRY_SAVED, ORDER_ASC, ORDER_DESC,
)


@login_required
def home(request):
    if settings.HOME == 'yarr-home':
        raise Http404
    return HttpResponseRedirect(reverse(settings.HOME))


def get_entries(request, feed_pk, state):
    """
    Internal function to filter the entries
    """
    # Start building querystring
    qs = models.Entry.objects.select_related()
    
    # Look up feed
    feed = None
    if feed_pk is None:
        qs = qs.filter(feed__user=request.user)
    else:
        feed = get_object_or_404(models.Feed, pk=feed_pk, user=request.user)
        qs = qs.filter(feed=feed)
        
    # Filter further
    if state == ENTRY_UNREAD:
        qs = qs.unread()
    elif state == ENTRY_READ:
        qs = qs.read()
    elif state == ENTRY_SAVED:
        qs = qs.saved()
        
    return qs, feed
    
@login_required
def list_entries(
    request, feed_pk=None, state=None, template="yarr/list_entries.html",
):
    """
    Display a list of entries
    Takes optional arguments to determine which entries to list:
        feed_pk     Primary key for a Feed
        state       The state of entries to list; one of:
                    None            All entries
                    ENTRY_UNREAD    Unread entries
                    ENTRY_SAVED     Saved entries

    Takes a single querystring argument:
        order       If "asc", order chronologically (otherwise
                    reverse-chronologically).

    Note: no built-in url calls this with state == ENTRY_READ, but support
    exists for a custom url.
    """
    # Get entries queryset
    qs, feed = get_entries(request, feed_pk, state)
    
    order = request.GET.get('order', ORDER_DESC)
    if order == ORDER_ASC:
        qs = qs.order_by('date')
    else:
        qs = qs.order_by('-date')

    # Make list of available pks for this page
    available_pks = list(qs.values_list('pk', flat=True))
    
    # Paginate
    entries, pagination = utils.paginate(request, qs)
    
    # Base title
    if state is None:
        title = 'All items'
    elif state == ENTRY_UNREAD:
        title = 'Unread items'
    elif state == ENTRY_SAVED:
        title = 'Saved items'
    else:
        raise ValueError('Cannot list entries in unknown state')
        
    # Add tag feed to title
    if feed:
        title = '%s - %s' % (feed.title, title)
    
    # Get list of feeds for feed list
    feeds = models.Feed.objects.filter(user=request.user)
    
    # Determine current view for reverse
    if state is None:
        current_view = 'yarr-list_all'
    elif state == ENTRY_UNREAD:
        current_view = 'yarr-list_unread'
    elif state == ENTRY_SAVED:
        current_view = 'yarr-list_saved'
    
    return render(request, template, {
        'title':    title,
        'entries':  entries,
        'pagination': pagination,
        'feed':     feed,
        'feeds':    feeds,
        'state':    state,
        'order_asc':    order == ORDER_ASC,
        'constants':    constants,
        'current_view': current_view,
        'yarr_settings': {
            'add_jquery':       settings.ADD_JQUERY,
            # JavaScript YARR_CONFIG variables
            'config':   utils.jsonEncode({
                'api':  reverse('yarr-api_base'),
                'con':  '#yarr_con',
                'initial_state':    state,
                'initial_order':    order,
                'initial_feed':     feed_pk,
                'layout_fixed':     settings.LAYOUT_FIXED,
                'api_page_length':  settings.API_PAGE_LENGTH,
                'title_template':   settings.TITLE_TEMPLATE,
                'title_selector':   settings.TITLE_SELECTOR,
                'available_pks':    available_pks,
            }),
        },
    })
    
    
@login_required
def entry_state(
    request, feed_pk=None, entry_pk=None, state=None, if_state=None,
    template="yarr/confirm.html",
):
    """
    Change entry state for an entry, a feed, or all entries
    """
    # Filter entries by selection
    qs = models.Entry.objects.user(request.user)
    if entry_pk is not None:
        # Changing specific entry
        qs = qs.filter(pk=entry_pk)
        
    elif state == ENTRY_READ:
        if feed_pk is not None:
            # Changing all entries in a feed
            qs = qs.filter(feed__pk=feed_pk)
            
        # Only mark unread as read - don't change saved
        qs = qs.unread()
        
    else:
        # Either unknown state, or trying to bulk unread/save
        messages.error(request, 'Cannot perform this operation')
        return HttpResponseRedirect(reverse(home))
        
    # Check for if_state
    if if_state is not None:
        if if_state == ENTRY_UNREAD:
            qs = qs.unread()
        elif if_state == ENTRY_READ:
            qs = qs.read()
        elif if_state == ENTRY_SAVED:
            qs = qs.saved()
        else:
            messages.error(request, 'Unknown condition')
            return HttpResponseRedirect(reverse(home))
        
    # Check there's something to change
    count = qs.count()
    if count == 0:
        messages.error(request, 'No entries found to change')
        return HttpResponseRedirect(reverse(home))
    
    # Process
    if request.POST:
        # Change state and update unread count
        qs.set_state(state)
        
        # If they're not marked as read, they can't ever expire
        # If they're marked as read, they will be given an expiry date
        # when Feed._update_entries determines they can expire
        if state != ENTRY_READ:
            qs.clear_expiry()
        
        if state is ENTRY_UNREAD:
            messages.success(request, 'Marked as unread')
        elif state is ENTRY_READ:
            messages.success(request, 'Marked as read')
        elif state is ENTRY_SAVED:
            messages.success(request, 'Saved')
        return HttpResponseRedirect(reverse(home))
    
    # Prep messages
    op_text = {
        'verb': 'mark',
        'desc': '',
    }
    if state is ENTRY_UNREAD:
        op_text['desc'] = ' as unread'
    elif state is ENTRY_READ:
        op_text['desc'] = ' as read'
    elif state is ENTRY_SAVED:
        op_text['verb'] = 'save'
        
    if entry_pk:
        title = '%(verb)s item%(desc)s'
        msg = 'Are you sure you want to %(verb)s this item%(desc)s?'
    elif feed_pk:
        title = '%(verb)s feed%(desc)s'
        msg = 'Are you sure you want to %(verb)s all items in the feed%(desc)s?'
    else:
        title = '%(verb)s all items%(desc)s'
        msg = 'Are you sure you want to %(verb)s all items in every feed%(desc)s?'
    
    title = title % op_text
    title = title[0].upper() + title[1:]
    
    return render(request, template, {
        'title':    title,
        'message':  msg % op_text,
        'submit_label': title,
    })
    

    
@login_required
def feeds(request, template="yarr/feeds.html"):
    """
    Mark entries as saved
    Arguments:
        entry_pk    Primary key for an Entry (required)
        is_saved    If True, mark as saved
                    If False, unmark as saved
    """
    # Get list of feeds for feed list
    feeds = models.Feed.objects.filter(user=request.user)
    
    add_form = forms.AddFeedForm()
    
    return render(request, template, {
        'title':    'Manage feeds',
        'feed_form': add_form,
        'feeds':    feeds,
        'yarr_settings': {
            'add_jquery':       settings.ADD_JQUERY,
            # JavaScript YARR_CONFIG variables
            'config':   utils.jsonEncode({
                'api':  reverse('yarr-api_base'),
            }),
        },
    })
    

@login_required
def feed_form(
    request, feed_pk=None, template_add="yarr/feed_add.html",
    template_edit="yarr/feed_edit.html", success_url=None,
):
    """
    Add or edit a feed
    """
    # Detect whether it's add or edit
    if feed_pk is None:
        is_add = True
        form_class = forms.AddFeedForm
        feed = models.Feed()
        title = "Add feed"
        template = template_add
    else:
        is_add = False
        form_class = forms.EditFeedForm
        feed = get_object_or_404(models.Feed, user=request.user, pk=feed_pk)
        title = "Edit feed"
        template = template_edit
    
    # Process request
    if request.POST:
        feed_form = form_class(request.POST, instance=feed)
        
        if feed_form.is_valid():
            # Save changes
            if is_add:
                # Save feed
                # ++ Really we would like to get the feed at this point, to
                # ++ fill out the name and other feed details, and grab initial
                # ++ entries. However, feedparser isn't thread-safe yet, so for
                # ++ now we just have to wait for the next scheduled check
                feed = feed_form.save(commit=False)
                feed.title = feed.feed_url
                feed.user = request.user
                feed.save()
            else:
                feed = feed_form.save()
            
            # Report and redirect
            if success_url is None:
                messages.success(
                    request,
                    'Feed added.' if is_add else 'Changes saved',
                )
            return HttpResponseRedirect(
                reverse('yarr-feeds') if success_url is None else success_url
            )
    elif 'feed_url' in request.GET:
        feed_form = form_class(request.GET, instance=feed)
    else:
        feed_form = form_class(instance=feed)
    
    return render(request, template, {
        'title':    title,
        'feed_form': feed_form,
        'feed':     feed,
    })
    
    
@login_required
def feed_delete(request, feed_pk, template="yarr/confirm.html"):
    """
    Delete a feed (and its entries)
    Arguments:
        feed_pk     Primary key for the Feed (required)
    """
    # Look up entry
    feed = get_object_or_404(models.Feed, pk=feed_pk, user=request.user)
    
    # Update entry
    if request.POST:
        feed.delete()
        messages.success(request, 'Feed deleted')
        return HttpResponseRedirect(reverse(home))
    
    return render(request, template, {
        'title':    'Delete feed',
        'message':  'Are you sure you want to delete the feed "%s"?' % feed.title,
        'submit_label': 'Delete feed',
    })


@login_required
def feeds_export(request):
    """
    Export the user's feed list as OPML.
    """
    response = HttpResponse(
        utils.export_opml(request.user),
        mimetype='application/xml',
    )
    response['Content-Disposition'] = 'attachment; filename="feeds.opml"'
    return response


@login_required
def api_base(request):
    """
    Base API URL
    Currently just used to reverse for JavaScript
    """
    raise Http404


@login_required
def api_feed_get(request):
    """
    JSON API to get feed data
    
    Arguments passed on GET:
        feed_pks    List of feeds to get information about
        fields      List of model fields to get
                    If not provided, returns all fields
                    Excluded fields: id, user, all related fields
                    The pk (id) is provided as the key
    
    Returns in JSON format:
        success     Boolean indicating success
        feeds       Object with feed pk as key, feed data as object in value
    """
    # Get feeds queryset
    pks = request.GET.get('feed_pks', '')
    if pks:
        success = True
        feeds = models.Feed.objects.filter(
            user=request.user, pk__in=pks.split(','),
        )
    else:
        success = False
        feeds = models.Feed.objects.none()
    
    # Get safe list of attributes
    fields_available = [
        field.name for field in models.Feed._meta.fields
        if field.name not in [
            'id', 'user'
        ]
    ]
    fields_request = request.GET.get('fields', '')
    if fields_request:
        fields = [
            field_name for field_name in fields_request.split(',')
            if field_name in fields_available
        ]
    else:
        fields = fields_available
    
    # Prep list of safe fields which don't need to be escaped
    safe_fields = [
        field.name for field in models.Feed._meta.fields if (
            field.name in fields
            and isinstance(field, (
                django_models.DateTimeField,
                django_models.IntegerField,
            ))
        )
    ]
    
    # Get data
    data = {}
    for feed in feeds.values('pk', *fields):
        # Escape values as necessary, and add to the response dict under the pk
        data[feed.pop('pk')] = dict([
            (key, val if key in safe_fields else escape(val))
            for key, val in feed.items()
        ])
    
    # Respond
    return utils.jsonResponse({
        'success':  success,
        'feeds':    data,
    })
    
    
@login_required
def api_feed_pks_get(request):
    """
    JSON API to get entry pks for given feeds
    
    Arguments passed on GET:
        feed_pks    List of feeds to get entry pks for about
                    If none, returns entry pks for all feeds
        state       The state of entries to read
        order       The order to sort entries in
                    Defaults to ORDER_DESC
    
    Returns in JSON format:
        success     Boolean indicating success
        pks         Object with feed pk as key, list of entry pks as list value
        feed_unread Unread counts as dict, { feed.pk: feed.count_unread, ... }
    """
    feed_pks = request.GET.get('feed_pks', '')
    state = GET_state(request, 'state')
    order = request.GET.get('order', ORDER_DESC)
    
    # Get entries queryset, filtered by user and feed
    entries = models.Entry.objects.filter(feed__user=request.user)
    if feed_pks:
        try:
            entries = entries.filter(feed__pk__in=feed_pks.split(','))
        except Exception:
            return utils.jsonResponse({
                'success':  False,
                'msg':      'Invalid request',
            })
    
    # Filter by state
    if state == ENTRY_UNREAD:
        entries = entries.unread()
    elif state == ENTRY_READ:
        entries = entries.read()
    elif state == ENTRY_SAVED:
        entries = entries.saved()
    
    # Order them
    if order == ORDER_ASC:
        entries = entries.order_by('date')
    else:
        entries = entries.order_by('-date')
    
    # Get a list of remaining pks
    pks = list(entries.values_list('pk', flat=True))
    
    # Get unread counts for feeds in this response
    feed_unread = {}
    for feed in entries.feeds():
        feed_unread[str(feed.pk)] = feed.count_unread
        
    # Respond
    return utils.jsonResponse({
        'success':  True,
        'pks':      pks,
        'feed_unread': feed_unread,
    })
        
    
@login_required
def api_entry_get(request, template="yarr/include/entry.html"):
    """
    JSON API to get entry data
    
    Arguments passed on GET:
        entry_pks   List of entries to get
        order       Order to send them back in
                    Defaults to ORDER_DESC
        
    Returns in JSON format:
        success     Boolean indicating success
        entries     List of entries, rendered entry as object in value:
                    html    Entry rendered as HTML using template
    """
    pks = request.GET.get('entry_pks', '')
    order = request.GET.get('order', ORDER_DESC)
    
    # Get entries queryset
    if pks:
        success = True
        entries = models.Entry.objects.filter(
            feed__user=request.user, pk__in=pks.split(','),
        )
    else:
        success = False
        entries = models.Entry.objects.none()
    
    # Order them
    if order == ORDER_ASC:
        entries = entries.order_by('date')
    else:
        entries = entries.order_by('-date')
    
    # Render
    data = []
    compiled = loader.get_template(template)
    for entry in entries:
        data.append({
            'pk':       entry.pk,
            'feed':     entry.feed_id,
            'state':    entry.state,
            'html':     compiled.render(Context({
                'constants':    constants,
                'entry':        entry,
            }))
        })
    
    # Respond
    return utils.jsonResponse({
        'success':  success,
        'entries':  data,
    })
    

def GET_state(request, param):
    """
    Return an entry state constant or None
    """
    state = request.GET.get(param, '')
    if state == '':
        return None
    return int(state)

@login_required
def api_entry_set(request):
    """
    JSON API to set entry data
    
    Arguments passed on GET:
        entry_pks   List of entries to update
        state       New state
    
    Returns in JSON format:
        success     Boolean
        msg         Error message, if success == False
        feed_unread Unread counts as dict, { feed.pk: feed.count_unread, ... }
    """
    # Start assuming success
    success = True
    msg = ''
    feed_unread = {}
    
    # Get entries queryset
    pks = request.GET.get('entry_pks', '')
    if pks:
        pks = pks.split(',')
        entries = models.Entry.objects.filter(
            feed__user=request.user, pk__in=pks,
        )
    else:
        success = False
        msg = 'No entries found'
    
    
    # Check for if_state
    if_state = GET_state(request, 'if_state')
    if success and if_state is not None:
        if_state = int(if_state)
        if if_state == ENTRY_UNREAD:
            entries = entries.unread()
        elif if_state == ENTRY_READ:
            entries = entries.read()
        elif if_state == ENTRY_SAVED:
            entries = entries.saved()
        else:
            success = False
            msg = 'Unknown condition'
            
    
    # Update new state
    state = GET_state(request, 'state')
    if success:
        if state in (ENTRY_UNREAD, ENTRY_READ, ENTRY_SAVED):
            # Change state and get updated unread count
            feed_unread = entries.set_state(state, count_unread=True)
            
            # If they're not marked as read, they can't ever expire
            # If they're marked as read, they will be given an expiry date
            # when Feed._update_entries determines they can expire
            if state != ENTRY_READ:
                entries.clear_expiry()
            
            # Decide message
            if state == ENTRY_UNREAD:
                msg = 'Marked as unread'
            elif state == ENTRY_READ:
                msg = 'Marked as read'
            elif state == ENTRY_SAVED:
                msg = 'Saved'
    
        else:
            success = False
            msg = 'Unknown operation'
        
    # Respond
    return utils.jsonResponse({
        'success':  success,
        'msg':      msg,
        'feed_unread': feed_unread,
    })
