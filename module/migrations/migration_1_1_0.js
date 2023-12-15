async function processMigration() {
    let actors = game.actors;

    for (let actor of actors) {
        if (!actor.getFlag(game.system.id, 'version')) {
            console.log('Processing migration 1.1.0 for ' + actor.name + ' - ' + actor.id);

            let system = actor.system;

            migrateTextFieldsToNumberFields(system.header);

            for (let tab of system.tabs) {
                migrateTextFieldsToNumberFields(tab);
            }

            actor.setFlag(game.system.id, 'version', '1.1.0');

            await actor.update({
                system: {
                    header: actor.system.header,
                    tabs: actor.system.tabs
                }
            });

            console.log('\tFinished migration 1.1.0 for ' + actor.name + ' - ' + actor.id);
        }
    }
}

function migrateTextFieldsToNumberFields(component) {
    if (component) {
        if (component.type === 'textField') {
            if (component.format === 'integer') {
                component.type = 'numberField';
                component.allowRelative = true;
                component.allowDecimal = false;
                delete component.format;
            } else if (component.format === 'numeric') {
                component.type = 'numberField';
                component.allowRelative = true;
                component.allowDecimal = true;
                delete component.format;
            }
        }

        if (Array.isArray(component.contents)) {
            for (let subComp of component.contents) {
                if (Array.isArray(subComp)) {
                    for (let trueSubComp of subComp) {
                        migrateTextFieldsToNumberFields(trueSubComp);
                    }
                } else {
                    migrateTextFieldsToNumberFields(subComp);
                }
            }
        }

        if (Array.isArray(component.rowLayout)) {
            for (let subComp of component.rowLayout) {
                migrateTextFieldsToNumberFields(subComp);
            }
        }
    }
}

export default { processMigration };
