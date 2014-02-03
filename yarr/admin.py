from django.contrib import admin

from yarr import models


class FeedAdmin(admin.ModelAdmin):
    list_display = [
        'title', 'is_active', 'user', 'next_check', 'error',
    ]
    list_filter = ['is_active', 'user']
    search_fields = ['title', 'feed_url', 'site_url']
    actions = ['deactivate', 'clear_error']
    
    def deactivate(self, request, queryset):
        queryset.update(is_active=False)
    deactivate.short_description = 'Deactivate feed'
    
    def clear_error(self, request, queryset):
        queryset.update(is_active=True, error='')
    clear_error.short_description = "Clear error and reactivate feed"

admin.site.register(models.Feed, FeedAdmin)


class EntryAdmin(admin.ModelAdmin):
    list_display = [
        'title', 'date', 'state', 'feed',
    ]
    list_select_related = True
    search_fields = ['title', 'content',]

admin.site.register(models.Entry, EntryAdmin)
