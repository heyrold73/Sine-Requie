import templateFunctions from '../template-functions.js';

/**
 * Extend the basic ItemSheet
 * @abstract
 * @extends {ItemSheet}
 * @ignore
 */
export class EquippableItemSheet extends ItemSheet {
    _hasBeenRenderedOnce = false;

    constructor(item, options) {
        options.resizable = !item.system.display.fix_size;

        super(item, options);
    }

    /** @override */
    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            classes: ['custom-system', 'sheet', 'item'],
            template: 'systems/' + game.system.id + '/templates/item/item-sheet.html',
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

    /* -------------------------------------------- */

    /** @override */
    async getData() {
        // Retrieve the data structure from the base sheet. You can inspect or log
        // the context variable to see the structure, but some key properties for
        // sheets are the actor object, the data object, whether or not it's
        // editable, the items array, and the effects array.
        let context = super.getData();

        context = await context.item.templateSystem.getSheetData(context);

        context.isEmbedded = context.item.isEmbedded;
        context.isEditable = this.isEditable;

        return context;
    }

    /**
     * @override
     * @param force
     * @param options
     * @return {DocumentSheet|*}
     * @ignore
     */
    render(force, options = {}) {
        if (!this._hasBeenRenderedOnce) {
            this.position.width = this.item.system.display.width;
            this.position.height = this.item.system.display.height;

            this._hasBeenRenderedOnce = true;
        }

        this.options.resizable = !this.item.system.display.fix_size;

        let data = super.render(force, options);

        return data;
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
        html.find('.custom-system-customHeader').append(data.headerPanel);
        html.find('.custom-system-customBody').append(data.bodyPanel);

        return html;
    }

    /** @override */
    activateListeners(html) {
        this.item.templateSystem.activateListeners(html);
        super.activateListeners(html);
    }
}

let focusedElt;

/* Insert tabs & header on sheet rendering */
Hooks.on('renderEquippableItemSheet', function (app, html, data) {
    // Register in-sheet rich text editors
    html.find('.editor-content[data-edit]').each((i, div) => app._activateEditor(div));

    html.find('*').on('focus', (ev) => {
        focusedElt = ev.currentTarget.id;
    });

    if (focusedElt) {
        html.find('#' + focusedElt).trigger('focus');
    }
});
