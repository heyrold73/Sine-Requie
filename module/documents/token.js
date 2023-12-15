export class CustomToken extends TokenDocument {
    getBarAttribute(barName, { alternative } = {}) {
        let barData = super.getBarAttribute(barName, { alternative });

        if (barData) {
            let barAttribute = barData.attribute;

            let actor = this.actor;

            let propPath = barAttribute;
            if (barAttribute.startsWith('attributeBar')) {
                let barDefinition = foundry.utils.getProperty(actor.system, barAttribute);
                propPath = 'props.' + barDefinition?.key;
            }

            let propValue = foundry.utils.getProperty(actor.system, propPath);
            if (propValue !== undefined) {
                barData.editable = true;
            }
        }

        return barData;
    }
}
