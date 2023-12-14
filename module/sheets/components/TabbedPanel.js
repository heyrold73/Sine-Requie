import Container from './Container.js';
import Tab from './Tab.js';
import templateFunctions from '../template-functions.js';

/**
 * Tabbed Panel component
 * @ignore
 */
class TabbedPanel extends Container {
    /**
     * Constructor
     * @param {Object} data Component data
     * @param {string} data.key Component key
     * @param {string|null} [data.tooltip] Component tooltip
     * @param {string} data.templateAddress Component address in template, i.e. component path from entity.system object
     * @param {Array<Component>} [data.contents=[]] Container contents
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
            contents: contents,
            cssClass: cssClass,
            role: role,
            permission: permission,
            visibilityFormula: visibilityFormula,
            parent: parent
        });
    }

    /**
     * Renders component
     * @override
     * @param {TemplateSystem} entity Rendered entity (actor or item)
     * @param {boolean} [isEditable=true] Is the component editable by the current user ?
     * @return {Promise<JQuery<HTMLElement>>} The jQuery element holding the component
     */
    async _getElement(entity, isEditable = true, options = {}) {
        let activeKey = null;

        let renderableTabs = this.contents.filter((tab) => tab.canBeRendered(entity));

        try {
            activeKey = game.user.getFlag(game.system.id, entity.uuid + '.' + this.templateAddress + '.activeTab');
        } catch (e) {}

        if (renderableTabs.filter((tab) => tab.key === activeKey).length === 0) {
            activeKey = renderableTabs?.[0]?.key;
        }

        // Generating content
        let tabSection = $('<section></section>');
        let tabsContent = {};

        // Generating nav
        let tabNav = $('<nav></nav>');
        let tabsLink = {};

        tabNav.addClass('sheet-tabs tabs');

        for (let tab of renderableTabs) {
            tabsContent[tab.key] = await tab.render(entity, isEditable, options);
            tabSection.append(tabsContent[tab.key]);

            let tabSpan = $('<span></span>');
            if (tab.tooltip) {
                tabSpan.attr('title', tab.tooltip);
            }

            let tabLink = $('<a></a>');
            tabLink.addClass('item');
            tabLink.addClass(tab.key);
            tabLink.text(tab.name);

            tabLink.on('click', () => {
                tabsContent[activeKey].removeClass('active');
                tabsContent[tab.key].addClass('active');

                tabsLink[activeKey].removeClass('active');
                tabLink.addClass('active');

                game.user.setFlag(game.system.id, entity.uuid + '.' + this.templateAddress + '.activeTab', tab.key);
                activeKey = tab.key;
            });

            tabsLink[tab.key] = tabLink;

            if (entity.isTemplate) {
                let sortLeftTabButton = $('<a><i class="fas fa-caret-left custom-system-clickable"></i></a>');
                sortLeftTabButton.addClass('item custom-system-sort-left');
                sortLeftTabButton.attr('title', 'Sort tab to the left');

                sortLeftTabButton.on('click', () => {
                    tab.sortBeforeInParent(entity);
                });

                tabSpan.append(sortLeftTabButton);
            }

            tabSpan.append(tabLink);

            if (entity.isTemplate) {
                let sortRightTabButton = $('<a><i class="fas fa-caret-right custom-system-clickable"></i></a>');
                sortRightTabButton.addClass('item custom-system-sort-right');
                sortRightTabButton.attr('title', 'Sort tab to the right');

                sortRightTabButton.on('click', () => {
                    tab.sortAfterInParent(entity);
                });

                tabSpan.append(sortRightTabButton);
            }

            tabNav.append(tabSpan);
        }

        if (entity.isTemplate) {
            let controlSpan = $('<span></span>');

            let addTabButton = $('<a><i class="fas fa-plus-circle custom-system-clickable"></i></a>');
            addTabButton.addClass('item');
            addTabButton.addClass('custom-system-builder-add-tab');
            addTabButton.attr('title', 'Add new tab');

            addTabButton.on('click', () => {
                // Create dialog for tab edition
                templateFunctions.editTab(
                    ({ name, key, role = 0, permission = 0, visibilityFormula = null, tooltip = null }) => {
                        // This is called on dialog validation

                        // Checking for duplicate keys
                        let existingTab = this.contents.filter((tab) => tab.key === key);

                        if (existingTab.length > 0) {
                            ui.notifications.error('Could not create tab with duplicate key ' + key);
                        } else {
                            // Adding the new tab to the template
                            this.contents.push(
                                Tab.fromJSON(
                                    {
                                        name: name,
                                        key: key,
                                        role: role,
                                        permission: permission,
                                        visibilityFormula: visibilityFormula,
                                        tooltip: tooltip,
                                        contents: []
                                    },
                                    this.templateAddress + '.contents.' + this.contents.length,
                                    this
                                )
                            );

                            this.save(entity);
                        }
                    }
                );
            });

            let editTabButton = $('<a><i class="fas fa-edit custom-system-clickable"></i></a>');
            editTabButton.addClass('item');
            editTabButton.addClass('custom-system-builder-edit-tab');
            editTabButton.attr('title', 'Edit current tab');

            editTabButton.on('click', () => {
                let tab = this.contents.filter((tab) => tab.key === activeKey)[0];
                // Create dialog for tab edition
                templateFunctions.editTab(
                    ({ name, key, role = 0, permission = 0, visibilityFormula = null, tooltip = null }) => {
                        // This is called on dialog validation

                        // Checking for duplicate keys
                        let existingTab = this.contents.filter((tab) => tab.key === key);

                        if (existingTab.length > 0 && key !== activeKey) {
                            ui.notifications.error('Could not edit tab with duplicate key ' + key);
                        } else {
                            // Updating tab data
                            tab.edit(entity, {
                                name: name,
                                tooltip: tooltip,
                                key: key,
                                role: role,
                                permission: permission,
                                visibilityFormula: visibilityFormula
                            });
                        }
                    },
                    tab.toJSON()
                );
            });

            let deleteTabButton = $('<a><i class="fas fa-trash custom-system-clickable"></i></a>');
            deleteTabButton.addClass('item');
            deleteTabButton.addClass('custom-system-builder-delete-tab');
            deleteTabButton.attr('title', 'Delete current tab');

            deleteTabButton.on('click', () => {
                this.contents.filter((tab) => tab.key === activeKey)[0].delete(entity);
            });

            controlSpan.append(addTabButton);
            controlSpan.append(editTabButton);
            controlSpan.append(deleteTabButton);

            tabNav.append(controlSpan);
        }

        let jQElement = await super._getElement(entity, isEditable, options);

        let internalContents = jQElement.hasClass('custom-system-component-contents')
            ? jQElement
            : jQElement.find('.custom-system-component-contents');

        internalContents.append(tabNav);
        internalContents.append(tabSection);

        if (activeKey) {
            tabsContent[activeKey].addClass('active');
            tabsLink[activeKey].addClass('active');
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
            type: 'tabbedPanel'
        };
    }

    /**
     * Creates Tabbed Panel from JSON description
     * @override
     * @param {Object} json
     * @param {string} templateAddress
     * @param {Container|null} parent
     * @return {TabbedPanel}
     */
    static fromJSON(json, templateAddress, parent = null) {
        let tabbedPanel = new TabbedPanel({
            key: json.key,
            tooltip: json.tooltip,
            templateAddress: templateAddress,
            contents: [],
            cssClass: json.cssClass,
            role: json.role,
            permission: json.permission,
            visibilityFormula: json.visibilityFormula,
            parent: parent
        });

        let contents = [];
        for (let [index, tabData] of json?.contents?.entries() ?? []) {
            contents.push(Tab.fromJSON(tabData, templateAddress + '.contents.' + index, tabbedPanel));
        }

        tabbedPanel._contents = contents;

        return tabbedPanel;
    }

    /**
     * Gets pretty name for this component's type
     * @return {string} The pretty name
     * @throws {Error} If not implemented
     */
    static getPrettyName() {
        return 'Tabbed Panel';
    }

    /**
     * Get configuration form for component creation / edition
     * @return {Promise<JQuery<HTMLElement>>} The jQuery element holding the component
     */
    static async getConfigForm(existingComponent) {
        let mainElt = $('<div></div>');

        mainElt.append(
            await renderTemplate(
                `systems/${game.system.id}/templates/_template/components/tabbed-panel.html`,
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
        return super.extractConfig(html);
    }
}

/**
 * @ignore
 */
export default TabbedPanel;
