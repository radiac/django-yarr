from django import views
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.core.urlresolvers import reverse
from django.http import HttpResponseRedirect, Http404, HttpResponse
from django.shortcuts import get_object_or_404, render_to_response
from django.template import RequestContext, loader, Context
from django.utils import simplejson

from yarr import models, utils, settings


@login_required
def home(request):
    if settings.HOME == 'yarr-home':
        return Http404
    return HttpResponseRedirect(reverse(settings.HOME))


def get_entries(request, feed_pk, unread, saved):
    """
    Internal function to filter the entries
    Used by list_entries, api_list_entries
    """
    # Give priority to saved
    if saved:
        unread = False
    
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
        
    # Tag feed to title
    if feed:
        title = '%s: %s' % (feed.title, title)
    
    return render_to_response(template, RequestContext(request, {
        'title':    title,
        'entries':  entries,
        'available_pks': available_pks,
        'pagination': pagination,
        'feed':     feed,
        'saved':    saved,
        'unread':   unread,
        'yarr_settings': {
            'control_fixed':    settings.CONTROL_FIXED,
            'add_jquery':       settings.ADD_JQUERY,
            'api_page_length':  settings.API_PAGE_LENGTH,
        },
    }))
    
    
@login_required
def mark_read(
    request, entry_pk=None, is_read=True,
    template="yarr/confirm.html",
):
    """
    Mark entries as read
    Arguments:
        entry_pk    Primary key for an Entry
                    If None, all unread unsaved entries will be marked as read
        is_read     If True, mark as read
                    If False, mark as unread - but only if entry_pk is set
    """
    # Operation
    op = 'read' if is_read else 'unread'
    
    # Look up entry
    entry = None
    if entry_pk is not None:
        entry = get_object_or_404(
            models.Entry, pk=entry_pk, feed__user=request.user,
        )
    
    if request.POST:
        # Mark as read
        if entry is None:
            if is_read:
                # Mark all as read
                unread = models.Entry.objects.user(request.user).unread().unsaved()
                unread.update(read=True)
            else:
                messages.error(request, 'Cannot mark all as unread')
        else:
            entry.read = is_read
            entry.save()
            
        messages.success(request, 'Marked as %s' % op)
        return HttpResponseRedirect(reverse(home))
    
    # Prep messages
    title = 'Mark as %s' % op
    if entry is None:
        msg = 'Are you sure you want to mark all items as %s?' % op
    else:
        msg = 'Are you sure you want to mark this item as %s?' % op
    
    return render_to_response(template, RequestContext(request, {
        'title':    title,
        'message':  msg,
        'entry':    entry,
        'submit_label': title,
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
def api_entry_get(request, template="yarr/include/entry.html"):
    """
    JSON API to get entry data
    
    Arguments passed on GET:
        entry_pks   List of entries to get
    """
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
    
    # Render
    rendered = []
    compiled = loader.get_template(template)
    for entry in entries:
        rendered.append(
            compiled.render(Context({
                'entry':    entry,
            }))
        )
    
    # Respond
    return HttpResponse(
        simplejson.dumps({
            'success':  success,
            'entries':  rendered,
        }), mimetype='application/json'
    )
    

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
    return HttpResponse(
        simplejson.dumps({
            'success':  success,
            'msg':      msg,
        }), mimetype='application/json'
    )
    