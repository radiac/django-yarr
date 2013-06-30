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
        'pagination': pagination,
        'feed':     feed,
        'saved':    saved,
        'unread':   unread,
        'yarr_settings': {
            'control_fixed':    settings.CONTROL_FIXED,
            'add_jquery':       settings.ADD_JQUERY,
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
def api_list(request, template="yarr/include/entry.html"):
    """
    JSON API for getting entries
    """
    # Get entries queryset
    feed_pk = request.GET.get('feed_pk', None) or None
    unread = request.GET.get('unread', True) == 'true'
    saved = request.GET.get('saved', False) == 'true'
    qs, feed = get_entries(request, feed_pk, unread, saved)
    
    # Exclude pks already there
    pks = request.GET.get('pks', '')
    if pks:
        qs = qs.exclude(pk__in=pks.split(','))
        entries = qs[:settings.AJAX_PAGINATION]
    else:
        entries = []
    
    # Paginate and render
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
            'status':   True,
            'entries':  rendered,
        }), mimetype='application/json'
    )
    

@login_required
def api_entry(request):
    """
    JSON API for an entry
    """
    # Look up entry
    entry_pk = request.GET['entry_pk']
    entry = get_object_or_404(
        models.Entry, pk=entry_pk, feed__user=request.user,
    )
    
    # Get operation
    op = request.GET.get('op', None)
    
    # Report
    status = False
    msg = 'Unknown operation'
    
    # Update flags
    if op == 'read':
        is_read = request.GET.get('is_read', 'true') == 'true'
        entry.read = is_read
        entry.saved = False
        status = True
        msg = 'Marked as %s' % ('read' if is_read else 'unread')
    
    elif op == 'saved':
        is_saved = request.GET.get('is_saved', 'true') == 'true'
        entry.saved = is_saved
        entry.read = False
        status = True
        msg = 'Item saved' if is_saved else 'Item no longer saved'
    
    # Save
    entry.save()
    
    # Respond
    return HttpResponse(
        simplejson.dumps({
            'status':   status,
            'msg':      msg,
        }), mimetype='application/json'
    )
    