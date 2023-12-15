import Container from './Container.js';
import templateFunctions from '../template-functions.js';

/**
 * ExtensibleTable abstract class
 * @abstract
 * @ignore
 */
class ExtensibleTable extends Container {
    /**
     * Table header should be bold
     * @type {boolean}
     * @protected
     */
    _head;

    /**
     * Row layout additional data
     * @type {{}}
     * @protected
     */
    _rowLayout;

    /**
     * Display warning on row delete
     * @type {boolean}
     * @protected
     */
    _deleteWarning;

    /**
     * Constructor
     * @param {Object} data Component data
     * @param {string} data.key Component key
     * @param {string|null} [data.tooltip] Component tooltip
     * @param {string} data.templateAddress Component address in template, i.e. component path from entity.system object
     * @param {boolean} [data.head=false] Table head should be bold ?
     * @param {Array<Component>} [data.contents=[]] Container contents
     * @param {Object} [data.rowLayout={}] Dynamic table row layout
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
        head = false,
        contents = [],
        rowLayout = {},
        deleteWarning = false,
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
            contents: contents,
            cssClass: cssClass,
            role: role,
            permission: permission,
            visibilityFormula: visibilityFormula,
            parent: parent
        });
        this._head = head;
        this._rowLayout = rowLayout;
        this._deleteWarning = deleteWarning;
    }

    /**
     * Component property key
     * @override
     * @return {string|null}
     */
    get propertyKey() {
        return this.key;
    }

    /**
     * Swaps two dynamic table elements
     * @param {TemplateSystem} entity Rendered entity (actor or item)
     * @param {Number} rowIdx1
     * @param {Number} rowIdx2
     * @protected
     */
    _swapElements(entity, rowIdx1, rowIdx2) {
        let tableProps = foundry.utils.getProperty(entity.system.props, this.key);
        let tmpRow = {
            ...tableProps[rowIdx1]
        };

        tableProps[rowIdx1] = tableProps[rowIdx2];
        tableProps[rowIdx2] = tmpRow;

        entity.entity.update({
            system: {
                props: entity.system.props
            }
        });
    }

    /**
     * Deletes a row from the Table
     * @param entity
     * @param rowIdx
     * @protected
     */
    _deleteRow(entity, rowIdx) {
        let tableProps = foundry.utils.getProperty(entity.system.props, this.key);
        tableProps[rowIdx].deleted = true;

        entity.entity.update({
            system: {
                props: entity.system.props
            }
        });
    }

    /**
     * Opens component editor
     * @param {TemplateSystem} entity Rendered entity (actor or item)
     * @param {Object} options Component options
     * @param {Object} [options.defaultValues] Component default values
     * @param {Array} [options.allowedComponents] Allowed components
     */
    openComponentEditor(entity, options = {}) {
        // Open dialog to edit new component
        templateFunctions.component(
            (action, component) => {
                // This is called on dialog validation
                this.addNewComponent(entity, component, options);
            },
            {
                componentData: options.defaultValues,
                allowedComponents: options.allowedComponents,
                isDynamicTable: true,
                entity
            }
        );
    }

    /**
     * Adds new component to container, handling rowLayout
     * @override
     * @param {TemplateSystem} entity Rendered entity (actor or item)
     * @param {Object|Array<Object>} component New component
     * @param {Object} options Component options
     * @param {Object} [options.defaultValues] Component default values
     * @param {Array} [options.allowedComponents] Allowed components
     */
    async addNewComponent(entity, component, options = {}) {
        if (!Array.isArray(component)) {
            component = [component];
        }

        for (let aComp of component) {
            if (this._rowLayout[aComp.key]) {
                throw new Error("Component keys should be unique in the component's columns.");
            }
        }

        for (let aComponent of component) {
            // Add component
            this.contents.push(componentFactory.createComponents(aComponent));
            this._rowLayout[aComponent.key] = {
                align: aComponent.align,
                colName: aComponent.colName
            };
        }

        await this.save(entity);
    }

    replaceComponent(entity, oldComponent, newComponent) {
        super.replaceComponent(entity, oldComponent, newComponent);

        this._rowLayout[newComponent.key] = {
            align: newComponent.align,
            colName: newComponent.colName
        };

        if (oldComponent.key !== newComponent.key) {
            delete this._rowLayout[oldComponent.key];
        }
    }

    /**
     * Returns an array of all the component's keys in the Container
     * @returns {string[]}
     */
    getAllKeys() {
        let keys = [this.key];

        return keys;
    }

    /**
     * Returns an object of all the component's keys in the Container and their default value
     * @param {TemplateSystem} entity The entity containing the Container
     * @returns {Object}
     */
    getAllProperties(entity) {
        let properties = { [this.propertyKey]: null };

        return properties;
    }

    /**
     * Returns serialized component
     * @override
     * @return {Object}
     */
    toJSON() {
        let jsonObj = super.toJSON();

        let rowLayout = [];

        for (let component of jsonObj.contents) {
            rowLayout.push({
                ...component,
                align: this._rowLayout?.[component.key].align ?? 'left',
                colName: this._rowLayout?.[component.key].colName ?? ''
            });
        }

        delete jsonObj.contents;

        return {
            ...jsonObj,
            rowLayout: rowLayout,
            head: this._head,
            deleteWarning: this._deleteWarning
        };
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

        fieldData.head = html.find('#tableHead').is(':checked');
        fieldData.deleteWarning = html.find('#tableDeleteWarning').is(':checked');

        return fieldData;
    }
}

/**
 * @ignore
 */
export default ExtensibleTable;
