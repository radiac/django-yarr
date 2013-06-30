"""
Utils for yarr
"""

from django.core.paginator import Paginator, EmptyPage, InvalidPage

from yarr import settings


def paginate(request, qs, adjacent_pages=3):
    """
    Paginate a querystring and prepare an object for building links in template
    Returns:
        paginated   Paginated items
        pagination  Info for template
    """
    paginator = Paginator(qs, settings.PAGINATION)
    try:
        page = int(request.GET.get('p', '1'))
    except ValueError:
        page = 1
    try:
        paginated = paginator.page(page)
    except (EmptyPage, InvalidPage):
        paginated = paginator.page(paginator.num_pages)
    
    # Prep pagination vars
    total_pages = paginator.num_pages
    start_page = max(paginated.number - adjacent_pages, 1)
    if start_page <= 3:
        start_page = 1
    
    end_page = paginated.number + adjacent_pages + 1
    if end_page >= total_pages - 1:
        end_page = total_pages + 1
    
    page_numbers = [
        n for n in range(start_page, end_page) if n > 0 and n <= total_pages
    ]
    
    pagination = {
        'has_next':     paginated.has_next(),
        'next':         paginated.next_page_number() if paginated.has_next() else 0,
        
        'has_previous': paginated.has_previous(),
        'previous':     paginated.previous_page_number() if paginated.has_previous() else 0,
        
        'current':      paginated.number,
        'show_first':   1 not in page_numbers,
        'page_numbers': page_numbers,
        'show_last':    total_pages not in page_numbers,
        'total':        total_pages,
    }
    
    return paginated, pagination
