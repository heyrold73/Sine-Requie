/**
 * Extend the basic ItemSheet with some very simple modifications
 * @extends {ItemSheet}
 * @ignore
 */
export class UserInputTemplateItemSheet extends ItemSheet {
    /** @override */
    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            classes: ['custom-system', 'sheet', 'item', 'userInputTemplate'],
            template: `systems/${game.system.id}/templates/item/item-sheet.html`,
            width: 600,
            height: 600,
            tabs: [
                {
                    navSelector: '.sheet-tabs',
                    contentSelector: '.sheet-body'
                }
            ],
            scrollY: ['.custom-system-actor-content']
        });
    }

    /**
     * @override
     * @ignore
     */
    get template() {
        return `systems/${game.system.id}/templates/item/${this.item.type}-sheet.html`;
    }

    /** @override */
    async getData() {
        // Retrieve the data structure from the base sheet. You can inspect or log
        // the context variable to see the structure, but some key properties for
        // sheets are the actor object, the data object, whether or not it's
        // editable, the items array, and the effects array.
        let context = super.getData();

        context = await context.item.templateSystem.getSheetData(context);

        return context;
    }

    /** @override */
    activateListeners(html) {
        this.item.templateSystem.activateListeners(html);
        super.activateListeners(html);
    }

    async forceSubmit(...args) {
        return super._onSubmit(...args);
    }

    async _onSubmit(...args) {
        return this.item.templateSystem.handleSheetSubmit(...args);
    }

    /**
     * Render the inner application content
     * @param {object} data         The data used to render the inner template
     * @returns {Promise<jQuery>}   A promise resolving to the constructed jQuery object
     * @private
     * @override
     * @ignore
     */
    async _renderInner(data) {
        let html = await super._renderInner(data);

        // Append built sheet to html
        html.find('.custom-system-customBody').append(data.bodyPanel);

        return html;
    }
}
