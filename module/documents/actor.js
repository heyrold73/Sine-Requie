import TemplateSystem from './templateSystem.js';

/**
 * Extend the base Actor document
 * @extends {Actor}
 */
export class CustomActor extends Actor {
    /**
     * Is this actor a Template ?
     * @return {boolean}
     */
    get isTemplate() {
        return this.type === '_template';
    }

    /**
     * Is this actor a Template ?
     * @return {boolean}
     */
    get isAssignableTemplate() {
        return this.type === '_template';
    }

    /**
     * Template system in charge of generic templating handling
     * @return {TemplateSystem}
     */
    get templateSystem() {
        if (!this._templateSystem) {
            this._templateSystem = new TemplateSystem(this);
        }

        return this._templateSystem;
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

    /**
     * @ignore
     * @override
     */
    getRollData() {
        // Prepare character roll data.
        const data = super.getRollData();
        return this.templateSystem.getRollData(data);
    }

    /**
     * @ignore
     * @override
     */
    async getTokenDocument(data = {}) {
        let tokenData = foundry.utils.deepClone(await super.getTokenDocument(data));
        const rollData = this.getRollData();

        // Prepare character roll data.
        tokenData = foundry.utils.mergeObject(tokenData, rollData);

        return tokenData;
    }

    /**
     * Handle how changes to a Token attribute bar are applied to the Actor.
     * @param {string} attribute    The attribute path
     * @param {number} value        The target attribute value
     * @param {boolean} isDelta     Whether the number represents a relative change (true) or an absolute change (false)
     * @param {boolean} isBar       Whether the new value is part of an attribute bar, or just a direct value
     * @returns {Promise<documents.Actor>}  The updated Actor document
     * @ignore
     * @override
     */
    async modifyTokenAttribute(attribute, value, isDelta = false, isBar = true) {
        const current = foundry.utils.getProperty(this.system, attribute);

        if (isBar && attribute.startsWith('attributeBar')) {
            let barDefinition = foundry.utils.getProperty(this.system, attribute);
            if (barDefinition) {
                if (isDelta) value = Number(current.value) + value;

                value = Math.clamped(0, value, barDefinition.max);
                attribute = 'props.' + barDefinition.key;
                isBar = false;
                isDelta = false;
            }
        }

        return super.modifyTokenAttribute(attribute, value, isDelta, isBar);
    }

    /**
     * Forward the roll function to the templateSystem
     * @param args
     * @returns {Promise<ComputablePhrase>}
     */
    async roll(...args) {
        return this.templateSystem.roll(...args);
    }

    async reloadTemplate(...args) {
        return this.templateSystem.reloadTemplate(...args);
    }
}

Hooks.on('preCreateItem', (item, createData, options, userId) => {
    if (item.isOwned) {
        const actor = item.parent;
        if (!actor.templateSystem.canOwnItem(item)) return false; // prevent creation
    }
});
