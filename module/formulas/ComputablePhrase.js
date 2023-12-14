import Formula from './Formula.js';
import { postAugmentedChatMessage } from '../utils.js';

/**
 * Class holding computed phrase details, for explanation
 */
class ComputablePhrase {
    /**
     * The initial phrase to be computed
     * @type {string}
     * @private
     */
    _rawPhrase;

    /**
     * The built phrase with every inner formula replaced with a unique identifier
     * @type {string}
     * @private
     */
    _buildPhrase;

    /**
     * All the inner formulas computed, assigned with a unique identifier
     * @type {Object<Formula>}
     * @private
     */
    _computedFormulas = {};

    /**
     * Constructs new ComputablePhrase with a phrase to compute
     * @param {string} phrase The phrase to compute
     */
    constructor(phrase) {
        this._rawPhrase = phrase;
    }

    /**
     * Gets the raw formula
     * @returns {string}
     */
    get formula() {
        let phrase = this._buildPhrase;
        for (let key in this._computedFormulas) {
            phrase = phrase.replaceAll(key, this._computedFormulas[key].raw);
        }

        return phrase;
    }

    /**
     * Gets the computed formula, i.e. the raw formula with all token replaced by their parsed values
     * @returns {string}
     */
    get parsed() {
        let phrase = this._buildPhrase;
        for (let key in this._computedFormulas) {
            phrase = phrase.replaceAll(key, this._computedFormulas[key].parsed);
        }

        return phrase;
    }

    /**
     * Gets the phrase ready for replacements
     * @returns {string}
     */
    get buildPhrase() {
        return this._buildPhrase;
    }

    /**
     * Gets the resulting phrase, i.e. the fully computed values
     * @returns {string}
     */
    get result() {
        let phrase = this._buildPhrase;
        for (let key in this._computedFormulas) {
            phrase = phrase.replaceAll(key, this._computedFormulas[key].result ?? '');
        }

        return phrase;
    }

    /**
     * Gets the computed formulas of the phrase, for building purposes
     * @return {Object<Formula>}
     */
    get values() {
        return this._computedFormulas;
    }

    /**
     * Posts phrase as a Chat Message
     * @param options
     */
    postMessage(options) {
        postAugmentedChatMessage(this, options);
    }

    /**
     * Computes everything in the phrase, including dynamic data such as rolls and user inputs
     * @param {Object} props Property object used for variable replacing in the formula
     * @param {Object} [options]
     * @param {string|null} [options.reference] Reference used in case of dynamic table field syntax
     * @param {string|null} [options.defaultValue] Default value used in case a variable is not present in props. If null, computation will throw an UncomputableError if a value is not found.
     * @param {boolean} [options.computeExplanation=false] Indicates whether to compute Formula explanation
     * @param {boolean} [options.availableKeys=[]] Indicates the full key list which should be available to compute values
     * @param {Object} [options.triggerEntity=null] The triggering entity, i.e. the actor or item the Phrase is attached to
     * @param {Object} [options.linkedEntity=null] The linked entity, i.e. the item linked to the actor the Phrase is attached to
     * @return {ComputablePhrase} This phrase
     * @throws {UncomputableError} If a variable can not be computed
     */
    async compute(props, options = {}) {
        console.debug('Computing ' + this._rawPhrase);

        let phrase = this._rawPhrase;

        let localVars = {};

        let computedFormulas = {};
        let nComputed = 0;

        let processFormulas = async ({ buildPhrase, expression }) => {
            let allFormulas = this._extractFormulas(expression);

            for (let textFormula of allFormulas) {
                let computedId = 'form' + nComputed;

                if (textFormula.startsWith('${') && textFormula.endsWith('}$')) {
                    // Recurse to handle potential sub-scripts
                    let processedFormula = await processFormulas({
                        buildPhrase: textFormula.substring(2).slice(0, -2),
                        expression: textFormula.substring(2).slice(0, -2)
                    });

                    let formula = new Formula(processedFormula.expression);

                    // options.defaultValue = undefined;
                    await formula.compute(props, {
                        localVars,
                        ...options
                    });

                    // Saves formula data
                    computedFormulas[computedId] = formula;
                    buildPhrase = buildPhrase.replace(textFormula, computedId);

                    expression = expression.replace(textFormula, formula.result);

                    localVars = {
                        ...localVars,
                        ...formula.localVars
                    };
                } else if (textFormula.startsWith('%{') && textFormula.endsWith('}%')) {
                    // Recurse to handle potential sub-scripts
                    const processedFormula = await processFormulas({
                        buildPhrase: textFormula.substring(2).slice(0, -2),
                        expression: textFormula.substring(2).slice(0, -2)
                    });

                    const AsyncFunction = async function () {}.constructor;

                    let result;

                    try {
                        result = await AsyncFunction('entity', 'linkedEntity', processedFormula.expression)
                        (options.triggerEntity, options.linkedEntity);
                    } catch (err) {
                        if (options.defaultValue !== null && options.defaultValue !== undefined) {
                            result = options.defaultValue;
                            console.error(err);
                        } else {
                            throw err;
                        }
                    }

                    if (result === undefined) {
                        result = 'undefined';
                    }

                    if (result === null) {
                        result = 'null';
                    }

                    if (typeof result === 'object' && !Array.isArray(result)) {
                        result = 'object';
                    }

                    if (!(typeof result === 'number' || typeof result === 'boolean')) {
                        result = `'${result.toString()}'`;
                    }

                    let formula = new Formula(result);
                    await formula.compute(props, {
                        localVars,
                        ...options
                    });

                    // Saves formula data
                    computedFormulas[computedId] = formula;
                    buildPhrase = buildPhrase.replace(textFormula, computedId);

                    expression = expression.replace(textFormula, result);
                }

                nComputed++;
            }

            return { buildPhrase, expression };
        };

        const processedFormula = await processFormulas({ buildPhrase: phrase, expression: phrase });

        this._buildPhrase = processedFormula.buildPhrase;
        this._computedFormulas = computedFormulas;

        return this;
    }

    /**
     * Computes the phrase without any dynamic data such as rolls and user inputs. If rolls or user inputs syntax are present, will throw an error.
     * @param {Object} props Property object used for variable replacing in the formula
     * @param {Object} [options]
     * @param {string|null} [options.reference] Reference used in case of dynamic table field syntax
     * @param {string|null} [options.defaultValue] Default value used in case the variable is not present in props. If null, computation will throw an UncomputableError if a value is not found.
     * @param {boolean} [options.computeExplanation=false] Indicates whether to compute Formula explanation
     * @param {boolean} [options.availableKeys=[]] Indicates the full key list which should be available to compute values
     * @param {Object} [options.triggerEntity=null] The triggering entity, i.e. the actor or item the Phrase is attached to
     * @param {Object} [options.linkedEntity=null] The linked entity, i.e. the item linked to the actor the Phrase is attached to
     * @return {ComputablePhrase} This phrase
     * @throws {UncomputableError} If a variable can not be computed
     */
    computeStatic(props, options = {}) {
        console.debug('Computing ' + this._rawPhrase);

        let phrase = this._rawPhrase;

        let localVars = {};

        let computedFormulas = {};
        let nComputed = 0;

        let processFormulas = ({ buildPhrase, expression }) => {
            let allFormulas = this._extractFormulas(expression);

            for (let textFormula of allFormulas) {
                let computedId = 'form' + nComputed;

                if (textFormula.startsWith('${') && textFormula.endsWith('}$')) {
                    // Recurse to handle potential sub-scripts
                    let processedFormula = processFormulas({
                        buildPhrase: textFormula.substring(2).slice(0, -2),
                        expression: textFormula.substring(2).slice(0, -2)
                    });

                    let formula = new Formula(processedFormula.expression);

                    // options.defaultValue = undefined;
                    formula.computeStatic(props, {
                        localVars,
                        ...options
                    });

                    // Saves formula data
                    computedFormulas[computedId] = formula;
                    buildPhrase = buildPhrase.replace(textFormula, computedId);

                    expression = expression.replace(textFormula, formula.result);

                    localVars = {
                        ...localVars,
                        ...formula.localVars
                    };
                } else if (textFormula.startsWith('%{') && textFormula.endsWith('}%')) {
                    // Recurse to handle potential sub-scripts
                    const processedFormula = processFormulas({
                        buildPhrase: textFormula.substring(2).slice(0, -2),
                        expression: textFormula.substring(2).slice(0, -2)
                    });

                    let result;

                    try {
                        result = Function('entity', 'linkedEntity', processedFormula.expression)
                        (options.triggerEntity, options.linkedEntity);
                    } catch (err) {
                        if (options.defaultValue !== null && options.defaultValue !== undefined) {
                            result = options.defaultValue;
                            console.error(err);
                        } else {
                            throw err;
                        }
                    }

                    if (result === undefined) {
                        result = 'undefined';
                    }

                    if (result === null) {
                        result = 'null';
                    }

                    if (typeof result === 'object' && !Array.isArray(result)) {
                        result = 'object';
                    }

                    if (!(typeof result === 'number' || typeof result === 'boolean')) {
                        result = `'${result.toString()}'`;
                    }

                    let formula = new Formula(result);
                    formula.computeStatic(props, {
                        localVars,
                        ...options
                    });

                    // Saves formula data
                    computedFormulas[computedId] = formula;
                    buildPhrase = buildPhrase.replace(textFormula, computedId);

                    expression = expression.replace(textFormula, result);
                }

                nComputed++;
            }

            return { buildPhrase, expression };
        };

        const processedFormula = processFormulas({ buildPhrase: phrase, expression: phrase });

        this._buildPhrase = processedFormula.buildPhrase;
        this._computedFormulas = computedFormulas;

        return this;
    }

    /**
     * Computes a phrase, including dynamic data such as rolls and user inputs
     * @param {string} phrase The phrase to compute
     * @param {Object} props Property object used for variable replacing in the formula
     * @param {Object} [options]
     * @param {string|null} [options.reference] Reference used in case of dynamic table field syntax
     * @param {string|null} [options.defaultValue] Default value used in case the variable is not present in props. If null, computation will throw an UncomputableError if a value is not found.
     * @param {Object} [options.triggerEntity=null] The triggering entity, i.e. the actor or item the Phrase is attached to
     * @param {Object} [options.linkedEntity=null] The linked entity, i.e. the item linked to the actor the Phrase is attached to
     * @return {ComputablePhrase} The computed phrase
     * @throws {UncomputableError} If a variable can not be computed
     */
    static async computeMessage(phrase, props, options = {}) {
        let computablePhrase = new ComputablePhrase(phrase);
        await computablePhrase.compute(props, options);

        return computablePhrase;
    }

    /**
     * Computes a phrase without any dynamic data such as rolls and user inputs. If rolls or user inputs syntax are present, will throw an error.
     * @param {string} phrase The phrase to compute
     * @param {Object} props Property object used for variable replacing in the formula
     * @param {Object} options
     * @param {string|null} [options.reference] Reference used in case of dynamic table field syntax
     * @param {string|null} [options.defaultValue] Default value used in case the variable is not present in props. If null, computation will throw an UncomputableError if a value is not found.
     * @param {Object} [options.triggerEntity=null] The triggering entity, i.e. the actor or item the Phrase is attached to
     * @param {Object} [options.linkedEntity=null] The linked entity, i.e. the item linked to the actor the Phrase is attached to
     * @return {ComputablePhrase} The computed phrase
     * @throws {UncomputableError} If a variable can not be computed
     */
    static computeMessageStatic(phrase, props, options = {}) {
        let computablePhrase = new ComputablePhrase(phrase);
        computablePhrase.computeStatic(props, options);

        return computablePhrase;
    }

    _extractFormulas(expression) {
        const formulaType = 'formula';
        const scriptType = 'script';

        const formulaBrackets = ['${', '}$'];
        const scriptBrackets = ['%{', '}%'];

        let nFormulaBrackets = 0;
        let nScriptBrackets = 0;

        let extracted = [];
        let currentExtract = '';

        let extracting = null;

        for (let i = 0; i < expression.length; i++) {
            let currentChar = expression.charAt(i);
            let nextChar = expression.charAt(i + 1);

            let currentPair = currentChar + nextChar;

            if (currentPair === formulaBrackets[0]) {
                nFormulaBrackets++;
                if (!extracting) {
                    extracting = formulaType;
                }
            } else if (currentPair === scriptBrackets[0]) {
                nScriptBrackets++;
                if (!extracting) {
                    extracting = scriptType;
                }
            } else if (currentPair === formulaBrackets[1]) {
                nFormulaBrackets--;
                if (nFormulaBrackets === 0 && extracting === formulaType) {
                    extracting = null;
                    extracted.push(currentExtract + currentPair);
                    currentExtract = '';
                }
            } else if (currentPair === scriptBrackets[1]) {
                nScriptBrackets--;
                if (nFormulaBrackets === 0 && extracting === scriptType) {
                    extracting = null;
                    extracted.push(currentExtract + currentPair);
                    currentExtract = '';
                }
            }

            if (extracting) {
                currentExtract += currentChar;
            }
        }

        return extracted;
    }

    /**
     * Returns the fully computed phrase as a string
     * @return {string}
     */
    toString() {
        return this.result;
    }
}

globalThis.ComputablePhrase = ComputablePhrase;
