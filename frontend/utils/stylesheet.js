/*
** Dynamic stylesheet
*/

export class Sheet {
    constructor() {
        document.addEventListener(
            'DOMContentLoaded',
            () => {
                this._create();
            },
            false
        );

        this.pending = [];
        this.el = null;
    }

    _create() {
        // Create last stylesheet
        this.el = document.createElement('style');
        this.el.appendChild(document.createTextNode(''));  // for webkit
        document.head.appendChild(this.el);
        for (var i=0; i < this.pending.length; i++) {
            var rule = this.pending[i][0];
            var index = this.pending[i][1];
            this._insertRule(rule, index);
        }
    }

    insertRule(rule, index=null) {
        if (!this.el) {
            this.pending.push([rule, index]);
            return;
        }
        this._insertRule(rule, index);
    }

    _insertRule(rule, index) {
        if (index === null) {
            index = this.el.sheet.cssRules.length;
        }
        this.el.sheet.insertRule(rule, index);
    }
}

// Singleton
const sheet = new Sheet();
export default sheet;
