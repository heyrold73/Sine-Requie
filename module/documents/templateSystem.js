import Panel from '../sheets/components/Panel.js';
import { applyModifiers, removeEmpty } from '../utils.js';
import { UncomputableError } from '../errors/errors.js';
import templateFunctions from '../sheets/template-functions.js';

/**
 * Agnostic template system used in Actors & Items
 */
class TemplateSystem {
    /**
     * Unique version number to know when to reload Panels
     * @type {Number}
     */
    _templateSystemUniqueVersion;

    /**
     * Entity this template system applies to
     * @type {CustomActor | CustomItem}
     */
    entity;

    /**
     * Header part
     * @type {Panel}
     */
    customHeader;

    /**
     * Body part
     * @type {Panel}
     */
    customBody;

    /**
     * Timeout object before saving the sheet if delayed is on
     * @type {any}
     */
    saveTimeout;

    /**
     * Constructor
     * @param entity {CustomActor | CustomItem}
     */
    constructor(entity) {
        this.entity = entity;
    }

    /**
     * Is the entity a Template ?
     * @return {boolean}
     */
    get isTemplate() {
        return this.entity.isTemplate;
    }

    /**
     * Is the entity an assignable Template ?
     * @return {boolean}
     */
    get isAssignableTemplate() {
        return this.entity.isAssignableTemplate;
    }

    get system() {
        return this.entity.system;
    }

    get uuid() {
        return this.entity.uuid;
    }

    get entityType() {
        switch (this.entity.type) {
            case 'character':
            case '_template':
                return 'actor';
            case 'equippableItem':
            case '_equippableItemTemplate':
            case 'subTemplate':
            case 'userInputTemplate':
                return 'item';
        }
    }

    get items() {
        return this.entity.items;
    }

    get allowedComponents() {
        let allowedComponents = componentFactory.componentTypes;

        switch (this.entity.type) {
            case 'userInputTemplate':
                allowedComponents = allowedComponents.filter(
                    (componentType) => !['dynamicTable', 'textArea'].includes(componentType)
                );
                break;
            case '_equippableItemTemplate':
                allowedComponents = allowedComponents.filter(
                    (componentType) => !['conditionalModifierList'].includes(componentType)
                );
                break;
            default:
                break;
        }

        if (this.entityType === 'item') {
            allowedComponents = allowedComponents.filter((componentType) => !['itemContainer'].includes(componentType));
        }

        return allowedComponents;
    }

    render(...args) {
        this.entity.render(...args);
    }

    prepareData() {
        if (this._templateSystemUniqueVersion !== this.entity.system.templateSystemUniqueVersion) {
            this._templateSystemUniqueVersion = this.entity.system.templateSystemUniqueVersion;
            this.customHeader = null;
            this.customBody = null;
        }

        if (!this.customHeader) {
            this.customHeader = Panel.fromJSON(this.entity.system.header ?? {}, 'header');
        }

        if (!this.customBody) {
            this.customBody = Panel.fromJSON(this.entity.system.body, 'body');
        }

        this._prepareEntityData();
    }

    /**
     * Prepare Entity type specific data
     * @private
     */
    _prepareEntityData() {
        if (this.isTemplate) return;

        // Make modifications to system here.
        const system = this.entity.system;
        const items = this.items;

        const modifierPropsByKey = {};
        const allModifiers = this.getModifiers();

        for (let modifier of allModifiers) {
            this._computeModifierValues(modifier, modifier.originalEntity, modifierPropsByKey);
        }

        // Computing all properties
        let computableProps = {};

        computableProps['name'] = this.entity.name;

        let attributeBars = system.attributeBar;

        // Computable properties are labels within tabs / header and hidden attributes
        let headerSpecialFields = this._fetchSpecialFields(system.header);

        computableProps = {
            ...computableProps,
            ...headerSpecialFields.computable
        };

        attributeBars = {
            ...attributeBars,
            ...headerSpecialFields.attributeBar
        };

        let bodySpecialFields = this._fetchSpecialFields(system.body);

        computableProps = {
            ...computableProps,
            ...bodySpecialFields.computable
        };

        attributeBars = {
            ...attributeBars,
            ...bodySpecialFields.attributeBar
        };

        for (let hidden of system.hidden ?? []) {
            computableProps[hidden.name] = hidden.value;
        }

        for (let prop in computableProps) {
            if (prop.includes('.')) {
                let [dynamicTableKey, dynamicTableField] = prop.split('.');

                for (let row in foundry.utils.getProperty(system.props, dynamicTableKey)) {
                    if (!foundry.utils.getProperty(system.props, dynamicTableKey + '.' + row).deleted) {
                        foundry.utils.setProperty(
                            system.props,
                            `${dynamicTableKey}.${row}.${dynamicTableField}`,
                            undefined
                        );
                    }
                }
            } else {
                foundry.utils.setProperty(system.props, prop, undefined);
            }
        }

        system.props = removeEmpty(system.props);

        let computedProps;
        let uncomputedProps = { ...computableProps };

        // Loop while all props are not computed
        // Some computed properties are used in other computed properties, so we need to make several passes to compute them all
        do {
            computedProps = {};

            // For each uncomputed property, we try to compute it
            for (let prop in uncomputedProps) {
                try {
                    let newComputedRows = {};

                    if (prop.includes('.')) {
                        let [dynamicTableKey, dynamicTableField] = prop.split('.');

                        for (let row in foundry.utils.getProperty(system.props, dynamicTableKey)) {
                            if (!foundry.utils.getProperty(system.props, dynamicTableKey + '.' + row).deleted) {
                                let newValue = ComputablePhrase.computeMessageStatic(
                                    uncomputedProps[prop],
                                    system.props,
                                    {
                                        reference: `${dynamicTableKey}.${row}`,
                                        availableKeys: Object.keys(computableProps),
                                        triggerEntity: this
                                    }
                                ).result;

                                if (modifierPropsByKey[`${dynamicTableKey}.${row}.${dynamicTableField}`]) {
                                    newValue = applyModifiers(
                                        newValue,
                                        modifierPropsByKey[`${dynamicTableKey}.${row}.${dynamicTableField}`]
                                    );
                                }

                                foundry.utils.setProperty(
                                    newComputedRows,
                                    `${dynamicTableKey}.${row}.${dynamicTableField}`,
                                    newValue
                                );
                            }
                        }
                    } else {
                        newComputedRows[prop] = ComputablePhrase.computeMessageStatic(
                            uncomputedProps[prop],
                            system.props,
                            {
                                availableKeys: Object.keys(computableProps),
                                triggerEntity: this
                            }
                        ).result;

                        if (modifierPropsByKey[prop]) {
                            newComputedRows[prop] = applyModifiers(newComputedRows[prop], modifierPropsByKey[prop]);
                        }
                    }

                    // If successful, the property is added to computedProp and deleted from uncomputedProps
                    console.debug('Computed ' + prop + ' successfully !');
                    foundry.utils.mergeObject(computedProps, newComputedRows);
                    delete uncomputedProps[prop];
                } catch (err) {
                    if (err instanceof UncomputableError) {
                        console.debug(
                            'Passing prop ' + prop + ' (' + uncomputedProps[prop] + ') to next round of computation...'
                        );
                    } else {
                        throw err;
                    }
                }
            }

            console.debug({
                message:
                    'Computed props for ' +
                    this.entity.name +
                    ' - ' +
                    Object.keys(computedProps).length +
                    ' / ' +
                    Object.keys(uncomputedProps).length,
                computedProps: computedProps,
                leftToCompute: uncomputedProps
            });

            // We add the props computed in this loop to the entity's system
            system.props = foundry.utils.mergeObject(system.props, computedProps);
        } while (
            // If no uncomputed props are left, we computed everything, and we can stop
            // If computedProps is empty, that means nothing was computed in this loop, and there is an error in the property definitions
            // Probably a wrongly defined formula, or a loop in property definition
            Object.keys(uncomputedProps).length > 0 &&
            Object.keys(computedProps).length > 0
        );

        // We log the remaining uncomputable properties for debug
        if (Object.keys(uncomputedProps).length > 0) {
            console.warn('Some props were not computed.');
            console.warn(uncomputedProps);
        }

        if (system.attributeBar !== undefined) {
            for (let prop in attributeBars) {
                // Attribute bars can not be taken from dynamic tables
                if (!prop.includes('.')) {
                    let max = attributeBars[prop].max;
                    if (Number.isNaN(Number(max))) {
                        max = ComputablePhrase.computeMessageStatic(max ?? '0', system.props, {
                            defaultValue: 0,
                            triggerEntity: this
                        }).result;
                    }

                    let value = attributeBars[prop].value ?? foundry.utils.getProperty(system.props, prop);
                    if (Number.isNaN(Number(value))) {
                        value = ComputablePhrase.computeMessageStatic(value ?? '0', system.props, {
                            defaultValue: 0,
                            triggerEntity: this
                        }).result;
                    }

                    foundry.utils.setProperty(system.attributeBar, prop, {
                        value: value,
                        max: max,
                        key: prop
                    });
                }
            }
        }
    }

    _computeModifierValues(modifier, trigerringEntity, result) {
        try {
            if (modifier) {
                modifier.key = ComputablePhrase.computeMessageStatic(modifier.key, trigerringEntity.system.props, {
                    defaultValue: 0,
                    triggerEntity: trigerringEntity
                }).result;
                modifier.value = ComputablePhrase.computeMessageStatic(
                    modifier.formula,
                    trigerringEntity.system.props,
                    {
                        defaultValue: 0,
                        triggerEntity: trigerringEntity
                    }
                ).result;

                modifier.isSelected =
                    !modifier.conditionalGroup ||
                    this.system.activeConditionalModifierGroups.includes(modifier.conditionalGroup);

                result[modifier.key] ? result[modifier.key].push(modifier) : (result[modifier.key] = [modifier]);
            }
        } catch (err) {
            console.warn('There was an error computing a modifier', err);
        }
    }

    canOwnItem(newItem) {
        if (this.isTemplate) {
            return false;
        } else {
            if (newItem.type !== 'equippableItem') {
                return false;
            } else if (newItem.system.unique) {
                for (let ownedItem of this.items) {
                    if (ownedItem.getFlag('core', 'sourceId') === newItem.flags.core.sourceId) {
                        return false;
                    }
                }
            }
        }

        return true;
    }

    async getSheetData(context) {
        // Add the entity's data to context.system for easier access, as well as flags.
        context.system = context[this.entityType].system;
        context.flags = context[this.entityType].flags;

        // Add roll data for TinyMCE editors.
        context.rollData = this.getRollData();
        context = await this._prepareSheetData(context);

        return context;
    }

    /**
     * Pre-renders sheet contents
     * @param context
     * @private
     * @ignore
     */
    async _prepareSheetData(context) {
        if (this.customHeader) {
            context.headerPanel = await this.customHeader.render(this, this.entity.sheet.isEditable);
        }

        if (this.customBody) {
            context.bodyPanel = await this.customBody.render(this, this.entity.sheet.isEditable);
        }

        if (!this.isTemplate) {
            context.availableTemplates = game[this.entityType + 's'].filter((entity) => entity.isAssignableTemplate);
        }

        context.isGM = game.user.isGM;
        context.display = context.system.display;
        context.template = context.system.template;

        return context;
    }

    /**
     * @ignore
     * @override
     */
    getRollData(baseEntityData) {
        if (this.isTemplate) return;

        // Prepare character roll data.
        const data = this._getEntityRollData(baseEntityData);
        data.name = this.entity.name;

        return data;
    }

    /**
     * Prepare character roll data.
     * @private
     */
    _getEntityRollData(systemData = {}) {
        if (this.isTemplate) return;

        const rollData = foundry.utils.deepClone(systemData);

        if (rollData.props) {
            for (let [k, v] of Object.entries(rollData.props)) {
                rollData[k] = foundry.utils.deepClone(v);
            }
        }

        if (rollData.body) {
            delete rollData.body;
        }
        if (rollData.header) {
            delete rollData.header;
        }
        if (rollData.hidden) {
            delete rollData.hidden;
        }
        if (rollData.display) {
            delete rollData.display;
        }
        if (rollData.template) {
            delete rollData.template;
        }

        return rollData;
    }

    /**
     * Rolls a template's defined roll with this Character properties
     * @param {string} rollKey The key of the Component holding the roll
     * @param {Object} [options={}] Roll options
     * @param {boolean} [options.postMessage=true] If the roll should be automatically posted as a Chat Message
     * @returns {Promise<ComputablePhrase>} The computed roll
     * @throws {Error} If the key does not have a roll
     */
    async roll(rollKey, options = {}) {
        let { postMessage = true, alternative = false } = options;
        let refRoll = rollKey.split('.');
        let reference = null;
        let [filterMatch, parentProp, filterProp, filterValue] =
            refRoll.shift().match(/^([a-zA-Z0-9_]+)\(([a-zA-Z0-9_]+)=(.+)\)$/) ?? [];

        if (filterMatch) {
            let parent = foundry.utils.getProperty(this.entity.getRollData(), parentProp);

            let index = Object.keys(parent).filter((key) => parent[key][filterProp] === filterValue)[0];

            if (!index) {
                throw new Error('Roll formula not found in character sheet');
            }

            reference = parentProp + '.' + index;
            rollKey = parentProp + '.' + refRoll.join('.');
        }

        let rollType = alternative ? 'alternative' : 'main';

        // Recovering value from data
        let rollText = this.getCustomRolls()[rollType][rollKey];

        if (rollText) {
            let phrase = new ComputablePhrase(rollText);
            await phrase.compute(this.entity.system.props, {
                reference: reference,
                computeExplanation: true,
                triggerEntity: this
            });

            if (postMessage) {
                let speakerData = ChatMessage.getSpeaker({
                    actor: this.entity,
                    token: this.entity.getActiveTokens()?.[0]?.document,
                    scene: game.scenes.current
                });

                phrase.postMessage({
                    speaker: speakerData
                });
            }

            return phrase;
        } else {
            throw new Error('Roll formula not found in character sheet');
        }
    }

    /**
     * Gets all custom rolls defined in the character's template
     * @returns {Object}}
     */
    getCustomRolls() {
        // Computing all properties
        let customRolls = {
            main: {},
            alternative: {}
        };

        // Computable properties are labels within tabs / header and hidden attributes
        let headerRolls = this._fetchSpecialFields(this.entity.system.header);

        customRolls.main = {
            ...customRolls.main,
            ...headerRolls.rollable
        };

        customRolls.alternative = {
            ...customRolls.alternative,
            ...headerRolls.altRollable
        };

        let bodyRolls = this._fetchSpecialFields(this.entity.system.body);
        customRolls.main = {
            ...customRolls.main,
            ...bodyRolls.rollable
        };

        customRolls.alternative = {
            ...customRolls.alternative,
            ...bodyRolls.altRollable
        };

        return customRolls;
    }

    /**
     * Gets all special fields in a given component, and returns :
     * - computable and their formula
     * - rollable and their rollMessages
     * - attribute bars and their maximum value
     * @param {Component} component The root component to extract fields from
     * @param {Object} specialFieldList The combined list of special fields and info
     * @param {Object} specialFieldList.rollable The list of Rollable fields
     * @param {Object} specialFieldList.computable The list of Computable fields
     * @param {Object} specialFieldList.attributeBar The list of Attribute Bars
     * @param {Object} specialFieldList.keyedProperties The list of keyed properties in the template
     * @param {string} keyPrefix The prefix to add to a key, if needed
     * @return {Object} The combined list of special fields and info
     * @private
     */
    _fetchSpecialFields(
        component,
        specialFieldList = { rollable: {}, altRollable: {}, attributeBar: {}, computable: {}, keyedProperties: [] },
        keyPrefix = ''
    ) {
        if (component) {
            // Handling the table case, where the contents list is an Array of Arrays
            if (Array.isArray(component)) {
                for (let subComp of component) {
                    let subSpecialList = this._fetchSpecialFields(subComp, specialFieldList, keyPrefix);
                    specialFieldList = {
                        ...specialFieldList,
                        ...subSpecialList
                    };
                }
            } else {
                // Component needs key to be relevant
                if (component.key) {
                    if (component.rollMessage) {
                        specialFieldList.rollable[keyPrefix + component.key] = component.rollMessage;
                    }

                    if (component.altRollMessage) {
                        specialFieldList.altRollable[keyPrefix + component.key] = component.altRollMessage;
                    }

                    if (component.value) {
                        specialFieldList.computable[keyPrefix + component.key] = component.value;
                    }

                    if (component.maxVal) {
                        specialFieldList.attributeBar[keyPrefix + component.key] = { max: component.maxVal };
                    }

                    specialFieldList.keyedProperties.push(keyPrefix + component.key);
                }

                // Recurse on contents
                if (component.contents) {
                    let subSpecialList = this._fetchSpecialFields(component.contents, specialFieldList, keyPrefix);
                    specialFieldList = {
                        ...specialFieldList,
                        ...subSpecialList
                    };
                }
                // Recurse on dynamic tables
                if (component.rowLayout) {
                    let subSpecialList = this._fetchSpecialFields(
                        component.rowLayout,
                        specialFieldList,
                        keyPrefix + component.key + '.'
                    );
                    specialFieldList = {
                        ...specialFieldList,
                        ...subSpecialList
                    };
                }
            }
        }

        return specialFieldList;
    }

    /**
     * Gets all keys in template, in a set
     * @return {Set} The set of keys
     */
    getKeys() {
        let keys = new Set(
            [].concat(
                this.entity.system.hidden?.map((elt) => elt.name),
                this.customHeader?.getAllKeys(),
                this.customBody?.getAllKeys()
            )
        );

        // Adding special key 'name', used by the field on top of the sheets.
        keys.add('name');
        keys.delete('');

        return keys;
    }

    /**
     * Gets all properties and default values used in properties in template, in an object
     * @return {Object} The object containing all keys and default values
     */
    getAllProperties() {
        let properties = {
            ...Object.fromEntries(this.entity.system.hidden?.map((elt) => [elt.name, null])),
            ...this.customHeader?.getAllProperties(this),
            ...this.customBody?.getAllProperties(this)
        };

        // Adding special key 'name', used by the field on top of the sheets.
        properties.name = undefined;
        delete properties[''];

        return properties;
    }

    /**
     * Gets all modifiers, from items and active effects
     *
     * @returns {Array<Object>} All modifiers
     */
    getModifiers() {
        let modifiers = [];
        for (let item of this.items) {
            let itemTemplate = game.items.get(item.system.template);

            if (!itemTemplate) {
                let warnMsg = `Item template has been deleted for item ${item.name} - ${item.uuid} used in ${this.entity.name} - ${this.uuid}`;
                console.warn(warnMsg);
                ui?.notifications?.warn(warnMsg);
            }

            modifiers = modifiers.concat(
                itemTemplate?.system.modifiers?.map((modifier) => ({
                    ...modifier,
                    originalEntity: item.templateSystem
                })),
                item.system.modifiers?.map((modifier) => ({ ...modifier, originalEntity: item.templateSystem }))
            );
        }

        // Getting effect modifiers
        if (this.entity.statuses) {
            for (let statusId of this.entity.statuses) {
                modifiers = modifiers.concat(
                    this.system.activeEffects[statusId]?.map((modifier) => ({ ...modifier, originalEntity: this })) ??
                        []
                );
            }
        }

        return modifiers.filter((mod) => mod !== undefined);
    }

    /**
     * Gets all conditional modifier group names, from items and active effects
     *
     * @returns {Map<String, Object>} All conditional modifier, grouped by group names
     */
    getSortedConditionalModifiers() {
        const modifiers = this.getModifiers();
        const allGroups = {};

        modifiers.map((modifier) => {
            if (modifier.conditionalGroup) {
                if (!allGroups[modifier.conditionalGroup]) {
                    allGroups[modifier.conditionalGroup] = [modifier];
                } else {
                    allGroups[modifier.conditionalGroup].push(modifier);
                }
            }
        });

        return allGroups;
    }

    /**
     * Reloads this character templates, updating the component structure, and re-renders the sheet.
     * @param {string|null} [templateId=null] New template id. If not set, will reload the current template.
     */
    reloadTemplate(templateId = null) {
        templateId = templateId || this.entity.system.template;

        const template = game[this.entityType + 's'].get(templateId);

        for (let barName in this.entity.system.attributeBar) {
            if (!template.system.attributeBar[barName]) {
                template.system.attributeBar['-=' + barName] = null;
            }
        }

        let allProperties = template.templateSystem.getAllProperties();
        let availableKeys = new Set(Object.keys(allProperties));
        for (let prop in this.entity.system.props) {
            if (!availableKeys.has(prop)) {
                this.entity.system.props['-=' + prop] = true;
            }
        }

        for (let prop in allProperties) {
            if (this.entity.system.props[prop] === undefined && allProperties[prop] !== null) {
                this.entity.system.props[prop] = allProperties[prop];
            }
        }

        this.entity.sheet._hasBeenRenderedOnce = false;

        // Updates hidden properties, tabs & header data
        // Sheet rendering will handle the actual props creation
        this.entity
            .update({
                system: {
                    templateSystemUniqueVersion: template.system.templateSystemUniqueVersion,
                    template: templateId,
                    hidden: template.system.hidden,
                    body: template.system.body,
                    header: template.system.header,
                    display: template.system.display,
                    attributeBar: template.system.attributeBar,
                    activeEffects: template.system.activeEffects,
                    props: this.entity.system.props
                }
            })
            .then(() => {
                console.debug('Updated !');
                this.entity.render(false);
            });
    }

    async saveTemplate() {
        const history = this.addSnapshotHistory();

        await this.entity.update({
            system: {
                header: this.customHeader?.toJSON(),
                body: this.customBody?.toJSON(),
                templateSystemUniqueVersion: (Math.random() * 0x100000000) >>> 0
            },
            flags: {
                [game.system.id]: {
                    templateHistory: history,
                    templateHistoryRedo: []
                }
            }
        });

        this.entity.render(false);
    }

    addSnapshotHistory(diff = null) {
        if (!diff) {
            diff = DeepDiff.diff(
                {
                    header: this.entity.system.header,
                    body: this.entity.system.body
                },
                {
                    header: this.customHeader?.toJSON(),
                    body: this.customBody.toJSON()
                }
            );
        }

        let history = this.entity.getFlag(game.system.id, 'templateHistory') ?? [];
        history.push(diff);
        history = history.slice(-10);

        return history;
    }

    addSnapshotHistoryRedo(diff) {
        let redoHistory = this.entity.getFlag(game.system.id, 'templateHistoryRedo') ?? [];
        redoHistory.push(diff);
        redoHistory = redoHistory.slice(-10);

        return redoHistory;
    }

    async undoHistory() {
        let history = this.entity.getFlag(game.system.id, 'templateHistory') ?? [];
        let diff = history.pop();

        let redoHistory = this.addSnapshotHistoryRedo(diff);

        let state = {
            header: this.entity.system.header,
            body: this.entity.system.body
        };

        for (let aDiff of diff) {
            DeepDiff.revertChange(state, {}, aDiff);
        }

        await this.entity.update({
            flags: {
                [game.system.id]: {
                    templateHistory: history,
                    templateHistoryRedo: redoHistory
                }
            },
            system: {
                header: state.header,
                body: state.body,
                templateSystemUniqueVersion: (Math.random() * 0x100000000) >>> 0
            }
        });

        this.entity.render(false);
    }

    async redoHistory() {
        let redoHistory = this.entity.getFlag(game.system.id, 'templateHistoryRedo') ?? [];
        let diff = redoHistory.pop();

        const history = this.addSnapshotHistory(diff);

        let state = {
            header: this.entity.system.header,
            body: this.entity.system.body
        };

        for (let aDiff of diff) {
            DeepDiff.applyChange(state, {}, aDiff);
        }

        await this.entity.update({
            flags: {
                [game.system.id]: {
                    templateHistory: history,
                    templateHistoryRedo: redoHistory
                }
            },
            system: {
                header: state.header,
                body: state.body,
                templateSystemUniqueVersion: (Math.random() * 0x100000000) >>> 0
            }
        });

        this.entity.render(false);
    }

    setSaveTimeout(...args) {
        if (
            $(document.activeElement).parents(`#${this.entity.sheet.id}`).length === 0 ||
            ['checkbox', 'radio'].includes($(document.activeElement).prop('type')) ||
            ['select'].includes($(document.activeElement).prop('tagName').toLowerCase())
        ) {
            return this.entity.sheet.forceSubmit(...args);
        } else {
            clearTimeout(this.saveTimeout);
            this.saveTimeout = setTimeout(() => {
                this.setSaveTimeout(...args);
            }, 500);
        }
    }

    async handleSheetSubmit(...args) {
        if (game.settings.get(game.system.id, 'delayEntitySaving')) {
            clearTimeout(this.saveTimeout);
            this.saveTimeout = setTimeout(() => {
                this.setSaveTimeout(...args);
            }, 500);
        } else {
            return this.entity.sheet.forceSubmit(...args);
        }
    }

    activateListeners(html) {
        // -------------------------------------------------------------
        // Everything below here is only needed if the sheet is editable
        if (!this.entity.sheet.isEditable) return;

        if (this.isTemplate) {
            // Undo button
            html.find('.custom-system-undo').click((ev) => {
                this.undoHistory();
            });

            if ((this.entity.getFlag(game.system.id, 'templateHistory') ?? []).length === 0) {
                html.find('.custom-system-undo').prop('disabled', 'disabled');
            }

            // Redo button
            html.find('.custom-system-redo').click((ev) => {
                this.redoHistory();
            });

            if ((this.entity.getFlag(game.system.id, 'templateHistoryRedo') ?? []).length === 0) {
                html.find('.custom-system-redo').prop('disabled', 'disabled');
            }

            // Edit hidden attributes
            html.find('.custom-system-configure-attributes').click((ev) => {
                // Open the dialog for edition
                templateFunctions.attributes((newAttributes) => {
                    // This is called on dialog validation

                    // Update the entity with new hidden attributes
                    this.entity
                        .update({
                            system: {
                                hidden: newAttributes
                            }
                        })
                        .then(() => {
                            this.entity.render(false);
                        });
                }, this.entity.system.hidden);
            });

            // Edit attribute bars
            html.find('.custom-system-configure-attribute-bars').click((ev) => {
                // Open the dialog for edition
                templateFunctions.attributeBars((newAttributeBars) => {
                    // This is called on dialog validation
                    for (let barName in this.entity.system.attributeBar) {
                        if (!newAttributeBars[barName]) {
                            newAttributeBars['-=' + barName] = null;
                        }
                    }

                    // Update the entity with new hidden attributes
                    this.entity
                        .update({
                            system: {
                                attributeBar: newAttributeBars
                            }
                        })
                        .then(() => {
                            this.entity.render(false);
                        });
                }, this.entity.system.attributeBar);
            });

            // Edit display settings
            html.find('.custom-system-configure-display').click((ev) => {
                // Open the dialog for edition
                templateFunctions.displaySettings((displaySettings) => {
                    // This is called on dialog validation

                    // Update the entity with new hidden attributes
                    this.entity
                        .update({
                            system: {
                                display: displaySettings
                            }
                        })
                        .then(() => {
                            this.entity.render(false);
                        });
                }, this.entity.system.display);
            });

            // Edit active effects actions
            html.find('.custom-system-configure-active-effects').click((ev) => {
                let allEffects = CONFIG.statusEffects.map((anEffect) => {
                    anEffect.modifiers = this.entity.system.activeEffects[anEffect.id] ?? [];
                    anEffect.label = game.i18n.localize(anEffect.label);

                    return anEffect;
                });

                // Open the dialog for edition
                templateFunctions.modifiers((activeEffects) => {
                    // This is called on dialog validation

                    // Update the entity with new active effects modifiers
                    this.entity
                        .update({
                            system: {
                                activeEffects: activeEffects
                            }
                        })
                        .then(() => {
                            this.entity.render(false);
                        });
                }, allEffects);
            });

            // Reload all sheets
            html.find('.custom-system-reload-all-sheets').click((ev) => {
                Dialog.confirm({
                    title: 'Reload all character sheets ?',
                    content: '<p>Do you really want to reload all sheets at once ?</p>',
                    yes: () => {
                        let entities = game[this.entityType + 's'].filter(
                            (entity) => entity.system.template === this.entity.id
                        );

                        entities.forEach((entity) => entity.templateSystem.reloadTemplate());
                    },
                    no: () => {},
                    defaultYes: false
                });
            });

            html.on('dragenter', (event) => {
                html.find('.custom-system-droppable-container').addClass('custom-system-template-dragged-eligible');
                html.find('.custom-system-component-root').addClass('custom-system-template-dragged-eligible');
            });

            $(document).on('dragend', () => {
                $('.custom-system-template-dragged-eligible').removeClass(
                    'custom-system-template-dragged-eligible custom-system-template-dragged-over'
                );
            });
        } else {
            html.find('.custom-system-template-select #custom-system-reload-template').click((ev) => {
                if (game.user.isGM) {
                    const target = $(ev.currentTarget);
                    const templateId = target.parents('.custom-system-template-select').find('#template').val();

                    this.reloadTemplate(templateId);
                }
            });
        }

        html.find('.custom-system-configure-modifiers').click(async (ev) => {
            if (this.entity.sheet.isEditable) {
                let modifierBlock = {
                    modifiers: this.entity.system.modifiers,
                    id: 'item_mod',
                    label: 'Item modifiers',
                    visible: true
                };

                templateFunctions.modifiers(
                    (newModifiers) => {
                        // Update the entity with new hidden attributes
                        this.entity
                            .update({
                                system: {
                                    modifiers: newModifiers.item_mod
                                }
                            })
                            .then(() => {
                                this.entity.render(false);
                            });
                    },
                    [modifierBlock]
                );
            }
        });
    }
}

export default TemplateSystem;
