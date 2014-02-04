from django import forms

from yarr import settings, models

class AddFeedForm(forms.ModelForm):
    required_css_class = 'required'
    class Meta:
        model = models.Feed
        fields = ['feed_url']
        widgets = {
            'feed_url':     forms.TextInput(),
        }

def _build_frequency_choices():
    """
    Build a choices list of frequencies
    This will be removed when Yarr moves to automated frequencies
    """
    choices = []
    current = settings.MAXIMUM_INTERVAL
    HOUR = 60
    DAY = 60 * 24
    MIN = settings.MINIMUM_INTERVAL
    while current >= MIN:
        # Create humanised relative time
        # There are many ways to do this, but to avoid introducing a dependency
        # only to remove it again a few releases later, we'll do this by hand
        dd = 0
        hh = 0
        mm = current
        parts = []
        
        if mm > DAY:
            dd = mm / DAY
            mm = mm % DAY
            parts.append('%s day%s' % (dd, 's' if dd > 1 else ''))
            
        if mm > HOUR:
            hh = mm / HOUR
            mm = mm % HOUR
            parts.append('%s hour%s' % (hh, 's' if hh > 1 else ''))
        
        if mm > 0:
            parts.append('%s minute%s' % (mm, 's' if mm > 1 else ''))
        
        if len(parts) == 3:
            human = '%s, %s and %s' % tuple(parts)
        elif len(parts) == 2:
            human = '%s and %s' % tuple(parts)
        else:
            human = parts[0]
        
        choices.append((current, human))
        
        old = current
        current = int(current / 2)
        if old > MIN and current < MIN:
            current = MIN
    
    return choices

class EditFeedForm(forms.ModelForm):
    required_css_class = 'required'
    check_frequency = forms.ChoiceField(
        widget=forms.Select,
        choices=_build_frequency_choices(),
        label='Frequency',
        help_text=u'How often to check the feed for changes',
    )
    class Meta:
        model = models.Feed
        fields = ['text', 'feed_url', 'is_active', 'check_frequency']
        widgets = {
            'text':    forms.TextInput(),
            'feed_url': forms.TextInput(),
            'title':    forms.TextInput(),
        }
