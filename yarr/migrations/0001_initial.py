# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import models, migrations
from django.conf import settings
import django.core.validators


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='Entry',
            fields=[
                ('id', models.AutoField(verbose_name='ID', serialize=False, auto_created=True, primary_key=True)),
                ('state', models.IntegerField(default=0, choices=[(0, b'Unread'), (1, b'Read'), (2, b'Saved')])),
                ('expires', models.DateTimeField(help_text=b'When the entry should expire', null=True, blank=True)),
                ('title', models.TextField(blank=True)),
                ('content', models.TextField(blank=True)),
                ('date', models.DateTimeField(help_text=b'When this entry says it was published')),
                ('author', models.TextField(blank=True)),
                ('url', models.TextField(help_text=b'URL for the HTML for this entry', blank=True, validators=[django.core.validators.URLValidator()])),
                ('comments_url', models.TextField(help_text=b'URL for HTML comment submission page', blank=True, validators=[django.core.validators.URLValidator()])),
                ('guid', models.TextField(help_text=b'GUID for the entry, according to the feed', blank=True)),
            ],
            options={
                'ordering': ('-date',),
                'verbose_name_plural': 'entries',
            },
            bases=(models.Model,),
        ),
        migrations.CreateModel(
            name='Feed',
            fields=[
                ('id', models.AutoField(verbose_name='ID', serialize=False, auto_created=True, primary_key=True)),
                ('title', models.TextField(help_text=b'Published title of the feed')),
                ('feed_url', models.TextField(help_text=b'URL of the RSS feed', verbose_name=b'Feed URL', validators=[django.core.validators.URLValidator()])),
                ('text', models.TextField(help_text=b'Custom title for the feed - defaults to feed title above', verbose_name=b'Custom title', blank=True)),
                ('site_url', models.TextField(help_text=b'URL of the HTML site', verbose_name=b'Site URL', validators=[django.core.validators.URLValidator()])),
                ('added', models.DateTimeField(help_text=b'Date this feed was added', auto_now_add=True)),
                ('is_active', models.BooleanField(default=True, help_text=b'A feed will become inactive when a permanent error occurs')),
                ('check_frequency', models.IntegerField(help_text=b'How often to check the feed for changes, in minutes', null=True, blank=True)),
                ('last_updated', models.DateTimeField(help_text=b'Last time the feed says it changed', null=True, blank=True)),
                ('last_checked', models.DateTimeField(help_text=b'Last time the feed was checked', null=True, blank=True)),
                ('next_check', models.DateTimeField(help_text=b'When the next feed check is due', null=True, blank=True)),
                ('error', models.CharField(help_text=b'When a problem occurs', max_length=255, blank=True)),
                ('count_unread', models.IntegerField(default=0, help_text=b'Cache of number of unread items')),
                ('count_total', models.IntegerField(default=0, help_text=b'Cache of total number of items')),
                ('user', models.ForeignKey(to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ('title', 'added'),
            },
            bases=(models.Model,),
        ),
        migrations.AddField(
            model_name='entry',
            name='feed',
            field=models.ForeignKey(related_name='entries', to='yarr.Feed'),
            preserve_default=True,
        ),
    ]
