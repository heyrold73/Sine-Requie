import Label from './Label.js';
import templateFunctions from '../template-functions.js';
import Container from './Container.js';

/**
 * Table component
 * @ignore
 */
class Table extends Container {
    /**
     * Column count
     * @type {Number}
     * @private
     */
    _cols;

    /**
     * Row count
     * @type {Number}
     * @private
     */
    _rows;

    /**
     * Table layout
     * @type {string|null}
     * @private
     */
    _layout;

    /**
     * Table contents
     * @override
     * @type {Array<Array<Component>>}
     * @private
     */
    _contents;

    /**
     * Constructor
     * @param {Object} data Component data
     * @param {string} data.key Component key
     * @param {string|null} [data.tooltip] Component tooltip
     * @param {string} data.templateAddress Component address in template, i.e. component path from entity.system object
     * @param {Number} [data.cols=1] Column count
     * @param {Number} [data.rows=1] Row count
     * @param {string|null} [data.layout=null] Table layout
     * @param {Array<Array<Component>>} [data.contents=[]] Container contents
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
        cols = 1,
        rows = 1,
        layout = null,
        contents = [],
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
            contents: [],
            cssClass: cssClass,
            droppable: true,
            role: role,
            permission: permission,
            visibilityFormula: visibilityFormula,
            parent: parent
        });
        this._cols = cols;
        this._rows = rows;
        this._layout = layout;
        this._contents = contents;
    }

    /**
     * contents getter
     * @override
     * @return {Array<Array<Component>>}
     */
    get contents() {
        return this._contents;
    }

    /**
     * Renders component
     * @override
     * @param {TemplateSystem} entity Rendered entity (actor or item)
     * @param {boolean} [isEditable=true] Is the component editable by the current user ?
     * @return {Promise<JQuery<HTMLElement>>} The jQuery element holding the component
     */
    async _getElement(entity, isEditable = true, options = {}) {
        let baseElement = await super._getElement(entity, isEditable, options);
        let internalContents = baseElement.hasClass('custom-system-component-contents')
            ? baseElement
            : baseElement.find('.custom-system-component-contents');

        let jQElement = $('<table></table>');
        let tableBody = $('<tbody></tbody>');

        for (let rowNum = 0; rowNum < this._rows; rowNum++) {
            let tableRow = $('<tr></tr>');
            for (let colNum = 0; colNum < this._cols; colNum++) {
                let cellAlignment = this._layout ? this._layout.substr(colNum, 1) : 'l';

                let cellClass;
                switch (cellAlignment) {
                    case 'c':
                        cellClass = 'custom-system-cell-alignCenter';
                        break;
                    case 'r':
                        cellClass = 'custom-system-cell-alignRight';
                        break;
                    case 'l':
                    default:
                        cellClass = 'custom-system-cell-alignLeft';
                        break;
                }

                let cell = $('<td></td>');
                cell.addClass(cellClass);
                cell.addClass('custom-system-cell');

                if (this.contents?.[rowNum]?.[colNum]) {
                    cell.append(await this.contents[rowNum][colNum].render(entity, isEditable, options));
                } else {
                    if (entity.isTemplate) {
                        cell.append(await this.renderTemplateControls(entity, { rowNum, colNum }));
                    } else {
                        cell.append(
                            await new Label({
                                key: null,
                                icon: null,
                                value: '',
                                rollMessage: null,
                                style: null,
                                size: 'full-size'
                            }).render(entity)
                        );
                    }
                }

                tableRow.append(cell);
            }
            tableBody.append(tableRow);
        }

        jQElement.append(tableBody);

        internalContents.append(jQElement);
        return baseElement;
    }

    /**
     * Opens component editor
     * @param {TemplateSystem} entity Rendered entity (actor or item)
     * @param {Object} options Component options
     * @param {Number} options.rowNum New component's row number
     * @param {Number} options.colNum New component's col number
     */
    openComponentEditor(entity, { rowNum, colNum }) {
        // Open dialog to edit new component
        templateFunctions.component(
            (action, component) => {
                // This is called on dialog validation
                this.addNewComponent(entity, component, { rowNum, colNum });
            },
            { entity }
        );
    }

    /**
     * Adds new component to container, handling rowLayout
     * @override
     * @param {TemplateSystem} entity Rendered entity (actor or item)
     * @param {Object|Array<Object>} component
     * @param {Object} options Component data
     * @param {Number} [options.rowNum] New component's row number
     * @param {Number} [options.colNum] New component's col number
     * @param {Component} [options.insertBefore] Insert new component before this one. Default behaviour is to insert last.
     */
    async addNewComponent(entity, component, { rowNum, colNum, insertBefore }) {
        // Add component

        if ((rowNum !== undefined && colNum === undefined) || (rowNum === undefined && colNum !== undefined)) {
            throw new Error(
                'Adding to a table should be done by specifying both rowNum and colNum if one is specified.'
            );
        } else if (insertBefore) {
            for (let i = 0; i < this.contents.length; i++) {
                for (let j = 0; j < this.contents[i].length; j++) {
                    if (this.contents[i][j] === insertBefore) {
                        rowNum = i;
                        colNum = j;
                    }
                }
            }
        }

        if (rowNum === undefined && colNum === undefined) {
            throw new Error('Could not find position to add element.');
        } else {
            if (!this._contents[rowNum]) {
                this._contents[rowNum] = [];
            }
        }

        let entityKeys = entity.getKeys();

        if (Array.isArray(component)) {
            for (let aComp of component) {
                if (entityKeys.has(aComp.key)) {
                    let suffix = 1;
                    let originalKey = aComp.key;

                    do {
                        aComp.key = originalKey + '_copy' + suffix;
                        suffix++;
                    } while (entityKeys.has(aComp.key));
                }
            }
        } else {
            if (entityKeys.has(component.key)) {
                let suffix = 1;
                let originalKey = component.key;

                do {
                    component.key = originalKey + '_copy' + suffix;
                    suffix++;
                } while (entityKeys.has(component.key));
            }
        }

        if (Array.isArray(component) && component.length > 1) {
            component = {
                type: 'panel',
                key: null,
                contents: component
            };
        }

        if (this._contents[rowNum][colNum]) {
            component = {
                type: 'panel',
                key: null,
                contents: [component, this._contents[rowNum][colNum].toJSON()]
            };
        }

        this._contents[rowNum][colNum] = componentFactory.createComponents(component);

        await this.save(entity);
    }

    deleteComponent(entity, component) {
        this._contents = this._contents.map((row) => {
            let idx = row.indexOf(component);

            if (idx !== -1) {
                row[idx] = null;
            }

            return row;
        });
    }

    replaceComponent(entity, oldComponent, newComponent) {
        for (let i = 0; i < this._contents.length; i++) {
            for (let j = 0; j < this._contents[i].length; j++) {
                if (this._contents[i][j] === oldComponent) {
                    this._contents[i][j] = componentFactory.createComponents(newComponent);
                    return;
                }
            }
        }
    }

    /**
     * Returns an object of all the component's keys in the Container and their default value
     * @param {TemplateSystem} entity The entity containing the Container
     * @returns {Object}
     */
    getAllProperties(entity) {
        let properties = { [this.propertyKey]: undefined };

        for (let row of this.contents) {
            if (row) {
                for (let component of row) {
                    if (component) {
                        if (component instanceof Container) {
                            properties = {
                                ...properties,
                                ...component.getAllProperties(entity)
                            };
                        } else {
                            properties = {
                                ...properties,
                                [component.propertyKey]: component.defaultValue
                                    ? ComputablePhrase.computeMessageStatic(
                                          component.defaultValue,
                                          entity.system.props,
                                          {
                                              defaultValue: '',
                                              triggerEntity: entity
                                          }
                                      ).result
                                    : undefined
                            };
                        }
                    }
                }
            }
        }

        return properties;
    }

    getAllKeys() {
        let keys = [this.key];

        for (let row of this.contents) {
            if (row) {
                for (let component of row) {
                    if (component) {
                        if (component instanceof Container) {
                            keys = keys.concat(component.getAllKeys());
                        } else {
                            keys.push(component.key);
                        }
                    }
                }
            }
        }

        return keys;
    }

    /**
     * Returns serialized component
     * @override
     * @return {Object}
     */
    toJSON() {
        let jsonObj = super.toJSON();

        let tableContents = [];
        for (let row of this.contents ?? []) {
            if (!Array.isArray(row)) {
                row = [];
            }

            let rowContents = [];
            for (let component of row) {
                rowContents.push(component?.toJSON() ?? null);
            }
            tableContents.push(rowContents);
        }

        return {
            ...jsonObj,
            cols: this._cols,
            rows: this._rows,
            layout: this._layout,
            contents: tableContents,
            type: 'table'
        };
    }

    /**
     * Creates Table from JSON description
     * @override
     * @param {Object} json
     * @param {string} templateAddress
     * @param {Container|null} parent
     * @return {Table}
     */
    static fromJSON(json, templateAddress, parent = null) {
        let tableContents = [];

        let table = new Table({
            key: json.key,
            tooltip: json.tooltip,
            templateAddress: templateAddress,
            cols: json.cols,
            rows: json.rows,
            layout: json.layout,
            contents: tableContents,
            cssClass: json.cssClass,
            role: json.role,
            permission: json.permission,
            visibilityFormula: json.visibilityFormula,
            parent: parent
        });

        for (let [index, row] of (json.contents ?? []).entries()) {
            tableContents.push(componentFactory.createComponents(row, templateAddress + '.contents.' + index, table));
        }
        return table;
    }

    /**
     * Gets pretty name for this component's type
     * @return {string} The pretty name
     * @throws {Error} If not implemented
     */
    static getPrettyName() {
        return 'Table';
    }

    /**
     * Get configuration form for component creation / edition
     * @return {Promise<JQuery<HTMLElement>>} The jQuery element holding the component
     */
    static async getConfigForm(existingComponent) {
        let mainElt = $('<div></div>');

        mainElt.append(
            await renderTemplate(
                `systems/${game.system.id}/templates/_template/components/table.html`,
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

        fieldData.rows = html.find('#tableRows').val();
        fieldData.cols = html.find('#tableCols').val();
        fieldData.layout = html.find('#tableLayout').val();

        return fieldData;
    }
}

/**
 * @ignore
 */
export default Table;
