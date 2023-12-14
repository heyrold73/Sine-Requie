import InputComponent from './InputComponent.js';

/**
 * TextField component
 * @ignore
 */
class TextField extends InputComponent {
    /**
     * Text field allowed characters
     * @type {string|null}
     * @private
     */
    _charList;

    /**
     * Max input length
     * @type {Number}
     * @private
     */
    _maxLength;

    /**
     * Text field constructor
     * @param {Object} data Component data
     * @param {string} data.key Component key
     * @param {string|null} [data.tooltip] Component tooltip
     * @param {string} data.templateAddress Component address in template, i.e. component path from entity.system object
     * @param {string|null} [data.charList=null] Text field allowed characters
     * @param {string|null} [data.maxLength=null] Text field max length
     * @param {string|null} [data.label=null] Field label
     * @param {string|null} [data.defaultValue=null] Field default value
     * @param {string|null} [data.size=null] Field size. Can be full-size, small, medium or large.
     * @param {string|null} [data.cssClass=null] Additional CSS class to apply at render
     * @param {Number} [data.role=0] Component minimum role
     * @param {Number} [data.permission=0] Component minimum permission
     * @param {string|null} [data.visibilityFormula=null] Component visibility formula
     * @param {Container|null} [data.parent=null] Component's container
     */
    constructor({
        key,
        tooltip = null,
        templateAddress,
        charList = null,
        maxLength = null,
        label = null,
        defaultValue = null,
        size = null,
        cssClass = null,
        role = 0,
        permission = 0,
        visibilityFormula = null,
        parent = null
    }) {
        super({
            key: key,
            tooltip: tooltip,
            templateAddress: templateAddress,
            label: label,
            defaultValue: defaultValue,
            size: size,
            cssClass: cssClass,
            role: role,
            permission: permission,
            visibilityFormula: visibilityFormula,
            parent: parent
        });
        this._charList = charList;
        this._maxLength = maxLength;
    }

    /**
     * Renders component
     * @override
     * @param {TemplateSystem} entity Rendered entity (actor or item)
     * @param {boolean} [isEditable=true] Is the component editable by the current user ?
     * @param {Object} [options={}] Additional options usable by the final Component
     * @param {Object} [options.dynamicRowRef = null] Dynamic Table row reference, passed to the formula computing
     * @return {Promise<JQuery<HTMLElement>>} The jQuery element holding the component
     */
    async _getElement(entity, isEditable = true, options = {}) {
        let { dynamicRowRef = null } = options;

        let jQElement = await super._getElement(entity, isEditable, options);
        jQElement.addClass('custom-system-text-field');

        let inputElement = $('<input />');
        inputElement.attr('type', 'text');
        inputElement.attr('id', `${entity.uuid}-${this.key}`);

        if (!entity.isTemplate) {
            inputElement.attr('name', 'system.props.' + this.key);
        }

        if (!isEditable) {
            inputElement.attr('disabled', 'disabled');
        }

        const fieldValue =
            foundry.utils.getProperty(entity.system.props, this.key) ??
            ComputablePhrase.computeMessageStatic(this.defaultValue, entity.system.props, {
                reference: dynamicRowRef,
                defaultValue: '',
                triggerEntity: entity
            }).result;

        inputElement.val(fieldValue);

        let changeEventAdded = false;
        inputElement.on('keydown', () => {
            let oldValue = inputElement.val();

            // Triggers the change only once
            if (!changeEventAdded) {
                changeEventAdded = true;
                inputElement.one('change', () => {
                    changeEventAdded = false;
                    let newValue = inputElement.val();

                    if (this._maxLength && this._maxLength > 0 && newValue.length > this._maxLength) {
                        newValue = newValue.substring(0, this._maxLength);
                    }

                    if (this._charList) {
                        let validationRegex = new RegExp('^[' + this._charList.replace('\\', '\\\\') + ']*$');
                        if (!newValue.match(validationRegex)) {
                            newValue = oldValue;
                            ui.notifications.warn('Value contains unauthorized characters');
                        }
                    }

                    inputElement.val(newValue);
                });
            }
        });

        jQElement.append(inputElement);

        if (entity.isTemplate) {
            jQElement.addClass('custom-system-editable-component');
            inputElement.addClass('custom-system-editable-field');

            jQElement.on('click', (ev) => {
                ev.preventDefault();
                ev.stopPropagation();

                this.editComponent(entity);
            });
        }

        return jQElement;
    }

    /**
     * Returns serialized component
     * @override
     * @return {Object}
     */
    toJSON() {
        let jsonObj = super.toJSON();

        return {
            ...jsonObj,
            charList: this._charList,
            maxLength: this._maxLength,
            type: 'textField'
        };
    }

    /**
     * Creates TextField from JSON description
     * @override
     * @param {Object} json
     * @param {string} templateAddress
     * @param {Container|null} parent
     * @return {TextField}
     */
    static fromJSON(json, templateAddress, parent = null) {
        return new TextField({
            key: json.key,
            tooltip: json.tooltip,
            templateAddress: templateAddress,
            charList: json.charList,
            maxLength: json.maxLength,
            label: json.label,
            defaultValue: json.defaultValue,
            size: json.size,
            cssClass: json.cssClass,
            role: json.role,
            permission: json.permission,
            visibilityFormula: json.visibilityFormula,
            parent: parent
        });
    }

    /**
     * Gets pretty name for this component's type
     * @return {string} The pretty name
     * @throws {Error} If not implemented
     */
    static getPrettyName() {
        return 'Text field';
    }

    /**
     * Get configuration form for component creation / edition
     * @return {Promise<JQuery<HTMLElement>>} The jQuery element holding the component
     */
    static async getConfigForm(existingComponent) {
        let mainElt = $('<div></div>');

        mainElt.append(
            await renderTemplate(
                `systems/${game.system.id}/templates/_template/components/textField.html`,
                existingComponent
            )
        );

        return mainElt;
    }

    /**
     * Extracts configuration from submitted HTML form
     * @override
     * @param {JQuery<HTMLElement>} html The submitted form
     * @return {Object} The JSON representation of the component
     * @throws {Error} If configuration is not correct
     */
    static extractConfig(html) {
        let fieldData = super.extractConfig(html);

        if (!fieldData.key) {
            throw new Error('Component key is mandatory for text fields');
        }

        fieldData.label = html.find('#textFieldLabel').val();
        fieldData.defaultValue = html.find('#textFieldValue').val();
        fieldData.size = html.find('#textFieldSize').val();
        fieldData.charList = html.find('#textFieldCharList').val();
        fieldData.maxLength = html.find('#textFieldMaxLength').val();

        return fieldData;
    }
}

/**
 * @ignore
 */
export default TextField;
