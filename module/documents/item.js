import TemplateSystem from './templateSystem.js';

export class CustomItem extends Item {
    /**
     * Is this item a Template ?
     * @return {boolean}
     */
    get isTemplate() {
        return (
            this.type === '_equippableItemTemplate' || this.type === 'subTemplate' || this.type === 'userInputTemplate'
        );
    }

    /**
     * Is this item an assignable Template ?
     * @return {boolean}
     */
    get isAssignableTemplate() {
        return this.type === '_equippableItemTemplate';
    }

    /**
     * Template system in charge of generic templating handling
     * @type {TemplateSystem}
     */
    get templateSystem() {
        if (!this._templateSystem) {
            this._templateSystem = new TemplateSystem(this);
        }

        return this._templateSystem;
    }

    get items() {
        return new Collection();
    }

    /**
     * @override
     * @ignore
     */
    _onCreate(data, options, userId) {
        super._onCreate(data, options, userId);

        if (this.permission === CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER) {
            if (!data.flags?.[game.system.id]?.version) {
                this.setFlag(game.system.id, 'version', game.system.version);
            }
        }
    }

    /**
     * @override
     * @ignore
     */
    _preCreateEmbeddedDocuments(embeddedName, result, options, userId) {
        if (embeddedName === 'Item') {
            if (this.isTemplate) {
                result.splice(0, result.length);
            } else {
                let idxToRemove = [];
                for (let document of result) {
                    if (document.type !== 'equippableItem') {
                        idxToRemove.push(result.indexOf(document));
                    }
                }

                for (let i = idxToRemove.length - 1; i >= 0; i--) {
                    result.splice(idxToRemove[i], 1);
                }
            }
        }
    }

    /**
     * @override
     * @ignore
     */
    async importFromJSON(...args) {
        let res = super.importFromJSON(...args);

        await this.update({
            system: {
                templateSystemUniqueVersion: (Math.random() * 0x100000000) >>> 0
            }
        });

        return res;
    }

    /**
     * @override
     * @ignore
     */
    prepareDerivedData() {
        this.templateSystem.prepareData();
    }
}
