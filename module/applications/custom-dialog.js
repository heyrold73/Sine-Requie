export default class CustomDialog extends Dialog {
    /**
     * Submit the Dialog by selecting one of its buttons
     * @param {Object} button         The configuration of the chosen button
     * @param {PointerEvent} event    The originating click event
     * @private
     * @override
     */
    submit(button, event) {
        try {
            let result = true;
            if (button.callback) result = button.callback(this.options.jQuery ? this.element : this.element[0], event);
            if (result !== false) this.close();
        } catch (err) {
            ui.notifications.error(err);
            throw new Error(err);
        }
    }
}
