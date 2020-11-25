import $ from 'jquery';

export class Status {
  constructor() {
    this.con = null;
    this.$el = null;
    this.timeout = null;
  }
  ensureDom() {
    // Ensure the status element is in the dom
    // Delayed creation allows pages to override the container
    if (this.$el) {
      return;
    }

    this.$el = $('<div class="status" />').appendTo(this.con).hide();
  }
  set(msg, isError) {
    this.ensureDom();

    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }

    if (!msg) {
      this.$el.hide();
      return;
    }

    this.$el.text(msg).show();
    this.$el.toggleClass('error', isError);

    this.timeout = setTimeout(() => this.close(), 1000);
  }
  close() {
    this.$el.fadeOut();
    this.timeout = null;
  }
}
