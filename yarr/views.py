from django import views
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.core.urlresolvers import reverse
from django.db import models as django_models
from django.http import HttpResponseRedirect, Http404, HttpResponse
from django.shortcuts import get_object_or_404, render_to_response
from django.template import RequestContext, loader, Context
from django.utils.html import escape

from yarr import settings, utils, models, forms


@login_required
def home(request):
    if settings.HOME == 'yarr-home':
        raise Http404
    return HttpResponseRedirect(reverse(settings.HOME))


def get_entries(request, feed_pk, unread, saved):
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
    if saved:
        qs = qs.saved()
    elif unread:
        qs = qs.unread().unsaved()
    
    return qs, feed
    
@login_required
def list_entries(
    request, feed_pk=None, unread=True, saved=False,
    template="yarr/list_entries.html",
):
    """
    Display a list of entries
    Takes optional arguments to determine which entries to list:
        feed_pk     Primary key for a Feed
        unread      If true, show only unread unsaved entries
        saved       If true, show only saved entries; priority over unread
    Note: an entry can only either be unread or saved, not both
    """
    # Saved has priority over unread
    if saved:
        unread = False
    
    # Get entries queryset
    qs, feed = get_entries(request, feed_pk, unread, saved)
    
    # Make list of available pks for this page
    available_pks = qs.values_list('pk', flat=True)
    
    # Paginate
    entries, pagination = utils.paginate(request, qs)
    
    # Base title
    if saved:
        title = 'Saved items'
    elif unread:
        title = 'Unread items'
    else:
        title = 'All items'
        
    # Add tag feed to title
    if feed:
        title = '%s - %s' % (feed.title, title)
    
    # Get list of feeds for feed list
    feeds = models.Feed.objects.filter(user=request.user)
    
    # Determine current view for reverse
    current_view = 'yarr-list_unread'
    if saved:
        current_view = 'yarr-list_saved'
    elif not unread:
        current_view = 'yarr-list_all'
    
    return render_to_response(template, RequestContext(request, {
        'title':    title,
        'entries':  entries,
        'available_pks': available_pks,
        'pagination': pagination,
        'feed':     feed,
        'feeds':    feeds,
        'saved':    saved,
        'unread':   unread,
        'current_view': current_view,
        'yarr_settings': {
            'add_jquery':       settings.ADD_JQUERY,
            'control_fixed':    settings.LAYOUT_FIXED,
            'api_page_length':  settings.API_PAGE_LENGTH,
            # JavaScript YARR_CONFIG variables
            'config':   utils.jsonEncode({
                'api':  reverse('yarr-api_base'),
                'con':  '#yarr_con',
            }),
        },
    }))
    
    
@login_required
def mark_read(
    request, feed_pk=None, entry_pk=None, is_read=True,
    template="yarr/confirm.html",
):
    """
    Mark entries as read
    Arguments:
        entry_pk    Primary key for the Entry to change
                    If None, will try feed_pk
        feed_pk     Primary key for the Feed to change
                    If None, all unread unsaved entries will be selected
        is_read     If True, mark selection as read
                    If False, mark selection as unread
    """
    # Select entries to update
    if entry_pk is not None:
        qs = models.Entry.objects.filter(pk=entry_pk, feed__user=request.user)
        
    elif feed_pk is not None:
        qs = models.Entry.objects.filter(feed__pk=feed_pk, feed__user=request.user)
        
    elif is_read:
        qs = models.Entry.objects.user(request.user).unread().unsaved()
        
    else:
        qs = models.Entry.objects.user(request.user).unsaved()
    
    count = qs.count()
    
    # Prepare the op for display
    display_op = 'read' if is_read else 'unread'
    
    # Check there's something to change
    if count == 0:
        messages.error(request, 'Nothing to mark as %s' % display_op)
        return HttpResponseRedirect(reverse(home))
    
    # Process
    if request.POST:
        qs.update(read=is_read)
        qs.update_feed_unread()
        messages.success(request, 'Marked as %s' % display_op)
        return HttpResponseRedirect(reverse(home))
    
    # Prep messages
    if entry_pk:
        title = 'Mark item as %s'
        msg = 'Are you sure you want to mark this item as %s?'
    elif feed_pk:
        title = 'Mark feed as %s'
        msg = 'Are you sure you want to mark all items in the feed as %s?'
    else:
        title = 'Mark all as %s'
        msg = 'Are you sure you want to mark all items in every feed as %s?'
    
    return render_to_response(template, RequestContext(request, {
        'title':    title % display_op,
        'message':  msg % display_op,
        'submit_label': title % display_op,
    }))
    
    
@login_required
def mark_saved(
    request, entry_pk, is_saved=True,
    template="yarr/confirm.html",
):
    """
    Mark entries as saved
    Arguments:
        entry_pk    Primary key for an Entry (required)
        is_saved    If True, mark as saved
                    If False, unmark as saved
    """
    # Look up entry
    entry = get_object_or_404(
        models.Entry, pk=entry_pk, feed__user=request.user,
    )
    
    # Update entry
    if request.POST:
        entry.saved = is_saved
        entry.save()
        
        if is_saved:
            msg = 'Item saved'
        else:
            msg = 'Item no longer saved'
        messages.success(request, msg)
        return HttpResponseRedirect(reverse(home))
    
    if is_saved:
        title = 'Save item'
        msg = 'Are you sure you want to save this item?'
    else:
        title = 'Unsave item'
        msg = 'Are you sure you no longer want to save this item?'
    
    return render_to_response(template, RequestContext(request, {
        'title':    title,
        'message':  msg,
        'entry':    entry,
        'submit_label': title,
    }))
    

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
    
    return render_to_response(template, RequestContext(request, {
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
    }))
    

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
    
    return render_to_response(template, RequestContext(request, {
        'title':    title,
        'feed_form': feed_form,
        'feed':     feed,
    }))
    
    
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
    
    return render_to_response(template, RequestContext(request, {
        'title':    'Delete feed',
        'message':  'Are you sure you want to delete the feed "%s"?' % feed.title,
        'submit_label': 'Delete feed',
    }))


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
def api_entry_get(request, template="yarr/include/entry.html"):
    """
    JSON API to get entry data
    
    Arguments passed on GET:
        entry_pks   List of entries to get
        
    Returns in JSON format:
        success     Boolean indicating success
        entries     Object with entry pk as key, entry data as object in value:
                    html    Entry rendered as HTML using template
    """
    # Get entries queryset
    pks = request.GET.get('entry_pks', '')
    if pks:
        success = True
        entries = models.Entry.objects.filter(
            feed__user=request.user, pk__in=pks.split(','),
        )
    else:
        success = False
        entries = models.Entry.objects.none()
    
    # Render
    data = {}
    compiled = loader.get_template(template)
    for entry in entries:
        data[entry.pk] = {
            'feed':     entry.feed_id,
            'read':     entry.read,
            'saved':    entry.saved,
            'html':     compiled.render(Context({'entry': entry}))
        }
    
    # Respond
    return utils.jsonResponse({
        'success':  success,
        'entries':  data,
    })
    

@login_required
def api_entry_set(request):
    """
    JSON API to set entry data
    
    Arguments passed on GET:
        entry_pks   List of entries to update
        op          Operation to perform
                    ``read``    Change read flag
                    ``saved``   Change saved flag
        is_read     New value of read flag, if ``op=read`` (else ignored)
                    Format: ``is_read=true`` or ``is_read==false``
        is_saved    New value of saved flag, if ``op=saved`` (else ignored)
                    Format: ``is_saved=true`` or ``is_saved==false``
    """
    # Start assuming the worst
    success = False
    msg = 'Unknown operation'
    
    # Get entries queryset
    pks = request.GET.get('entry_pks', '').split(',')
    if pks:
        success = True
        entries = models.Entry.objects.filter(
            feed__user=request.user, pk__in=pks,
        )
    else:
        success = False
        entries = models.Entry.objects.none()
    
    # Get operation
    op = request.GET.get('op', None)
    
    # Update flags
    if op == 'read':
        is_read = request.GET.get('is_read', 'true') == 'true'
        entries.update(
            read    = is_read,
            saved   = False,
        )
        entries.update_feed_unread()
        
        success = True
        msg = 'Marked as %s' % ('read' if is_read else 'unread')
    
    elif op == 'saved':
        is_saved = request.GET.get('is_saved', 'true') == 'true'
        entries.update(
            saved   = is_saved,
            read    = False,
        )
        success = True
        msg = 'Saved' if is_saved else 'No longer saved'
    
    # Respond
    return utils.jsonResponse({
        'success':  success,
        'msg':      msg,
    })
