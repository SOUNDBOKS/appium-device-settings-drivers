import * as assert from 'assert';
import * as fs from 'fs';

import * as WebdriverIO from 'webdriverio';

import { retry, retryIf, retryWithIntermediateStep } from '@soundboks/again';

const defaultTimeout = 7500;

// Note: shortcuts to the "async" types of WebdriverIO:
export type WebdriverBrowser = WebdriverIO.Browser<'async'>;
export type WebdriverElement = WebdriverIO.Element<'async'>;

// http://appium.io/docs/en/commands/element/find-elements/index.html#selector-strategies
type SelectorStrategy = 'accessibility id' | 'xpath' | 'class name' | 'id';

type ElementId = string; // Note: element ids are not persistent, being valid only until unmounted

export function isStaleElementExcepton(e: Error): boolean {
    return (e as Error).name === "stale element reference"
}

/*
Decorator that wraps a function in a retryIf to protect against 'stale element reference' errors
Other errors will still bubble up normally
*/
export function retryIfStaleElementException(target: any, name: string, descriptor: PropertyDescriptor) {
    const inner = descriptor.value
    descriptor.value = function (...args: any[]) {
        return retryIf(() => inner.apply(this, args), isStaleElementExcepton)
    }
}


export function allowToFail(errorHandler: (e: Error) => void = console.error) {
    return function (target: any, name: string, descriptor: PropertyDescriptor) {
        const inner = descriptor.value
        descriptor.value = function (...args: any[]) {
            try {
                let _ret = inner.apply(this, args)
                if (typeof _ret.then === 'function') {
                    return _ret.catch(errorHandler)
                }
                return _ret
            } catch (e) {
                console.error(errorHandler)
            }
        }
    }
}

export type Platform = "Android" | "iOS"

export class PhoneDriver {
    client: WebdriverBrowser;
    platform: Platform

    constructor(client: WebdriverBrowser, platform: Platform) {
        this.client = client;
        this.platform = platform

        this.setImplicitTimeout(defaultTimeout)
    }

    @allowToFail()
    async printScreen(namePrefix = 'print') {
        fs.mkdirSync('output/screen', { recursive: true })

        const screenshot = await retryIf(() => this.client.takeScreenshot(), isStaleElementExcepton)
        const pageSource = await retryIf(() => this.client.getPageSource(), isStaleElementExcepton);

        fs.writeFileSync(`output/screen/${namePrefix}.png`, Buffer.from(screenshot, 'base64'));
        fs.writeFileSync(`output/screen/${namePrefix}.xml`, pageSource);
        console.log('(printed to output/screen)');
    }

    async setImplicitTimeout(ms: number) {
        await this.client.setImplicitTimeout(ms);
    }

    /**
     * Increase the implicit timeout for the duration of the block and reset it back to default afterwards
     * @param ms timeout in milliseconds
     * @param block block to run 
     */
    async withPatience(ms: number, block: () => Promise<void>) {
        try {
            await this.setImplicitTimeout(ms);
            await block();
        } finally {
            await this.setImplicitTimeout(defaultTimeout);
        }
    }

    /**
     * Search for an element matching the given strategy and selector
     * @param using a selector strategy
     * @param value a valid selector for the given selector strategy
     * @returns The first element id or `undefined` if no element was found
     */
    async findElement(using: SelectorStrategy, value: string): Promise<ElementId | undefined> {
        // Note: deliberately avoid using this.client.$ to bypass the complexity of selector strategies
        const response = await this.client.findElement(using, value);
        // Note: eventually figure out why findElement return type is string when it actually returns something else
        const { ELEMENT: element /*, error*/ } = (response || { ELEMENT: null }) as unknown as { ELEMENT: string | null /*, error?: string */ };
        return element || undefined;
    }

    /**
     * Search for elements matching the given strategy and selector
     * @param using a selector strategy
     * @param value a valid selector for the given selector strategy
     * @returns A list of element ids
     */
    async findElements(using: SelectorStrategy, value: string): Promise<ElementId[]> {
        // Note: deliberately avoid using this.client.$$ to bypass the complexity of selector strategies
        const response = await this.client.findElements(using, value);
        // if (response.error) throw new Error(response.message)
        // Note: eventually figure out why findElements return type is string[] when it actually returns Element[]
        const webdriverElementList = (response || []) as unknown as WebdriverElement[];
        const elementList = webdriverElementList.map(({ ELEMENT: element }) => element);
        return elementList;
    }

    /**
     * Search for an element matching the given strategy and selector WITHIN the given initial element
     * @param initialElement an element scoping the search
     * @param using a selector strategy
     * @param value a valid selector for the given selector strategy
     * @returns The first element id or `undefined` if no element was found
     */
    async findElementFromElement(
        initialElement: ElementId, using: SelectorStrategy, value: string
    ): Promise<ElementId | undefined> {
        // Note: deliberately avoid using this.client.$$ to bypass the complexity of selector strategies
        const response = await this.client.findElementFromElement(initialElement, using, value);
        const { ELEMENT: element /*, error*/ } = (response || { ELEMENT: null }) as unknown as { ELEMENT: string | null /*, error?: string */ };

        return element || undefined;
    }

    /**
     * Search for an element with the given text
     * @param text text to search for
     * @returns The first element id or `undefined` if no element was found
     */
    async findByText(text: string): Promise<ElementId | undefined> {
        const hasSingleQuote = text.includes("'");
        const hasDoubleQuote = text.includes('"');
        if (hasSingleQuote && hasDoubleQuote) {
            throw new Error(`Not implemented: support for both single and double quote to lookup by xpath: ${text}`);
        }
        const q = hasSingleQuote ? '"' : "'";
        switch (this.platform) {
            case 'Android':
                return this.findElement('xpath', `//*[@text=${q}${text}${q}]`);
            case 'iOS': {
                // Note: can be XCUIElementTypeStaticText
                // Note: can be XCUIElementTypeOther
                // Note: return first if more elements found
                const [element] = await this.findElements('xpath', `//*[@name=${q}${text}${q}]`);
                return element;
            }
        }
    }


    /**
     * Search for an element whose text includes the search string
     * @param text text to search for
     * @returns The first element id or `undefined` if no element was found
     */
    async findByIncludesText(text: string): Promise<ElementId | undefined> {
        const hasSingleQuote = text.includes("'");
        const hasDoubleQuote = text.includes('"');
        if (hasSingleQuote && hasDoubleQuote) {
            throw new Error(`Not implemented: support for both single and double quote to lookup by xpath: ${text}`);
        }
        const q = hasSingleQuote ? '"' : "'";
        switch (this.platform) {
            case 'Android':
                return this.findElement('xpath', `//*[contains(@text, ${q}${text}${q})]`);
            case 'iOS': {
                // Note: can be XCUIElementTypeStaticText
                // Note: can be XCUIElementTypeOther
                // Note: return first if more elements found
                const [element] = await this.findElements('xpath', `//*[contains(@name, ${q}${text}${q})]`);
                return element;
            }
        }
    }

    /**
     * Search for elements with the given text
     * @param text text to search for
     * @returns A list of element ids
     */
    async findAllByText(text: string): Promise<ElementId[]> {
        const hasSingleQuote = text.includes("'");
        const hasDoubleQuote = text.includes('"');
        if (hasSingleQuote && hasDoubleQuote) {
            throw new Error(`Not implemented: support for both single and double quote to lookup by xpath: ${text}`);
        }
        const q = hasSingleQuote ? '"' : "'";
        switch (this.platform) {
            case 'Android':
                return await this.findElements('xpath', `//*[@text=${q}${text}${q}]`);
            case 'iOS': {
                // Note: can be XCUIElementTypeStaticText
                // Note: can be XCUIElementTypeOther
                // Note: return first if more elements found
                return await this.findElements('xpath', `//*[@name=${q}${text}${q}]`);
            }
        }
    }

    /**
     * Search for the last element with the given text
     * @param text text to search for
     * @returns The last element id or `undefined` if no element was found
     */
    async findLastByText(text: string): Promise<ElementId | undefined> {
        const elementList = await this.findAllByText(text);
        const element = elementList[elementList.length - 1];
        return element;
    }

    /**
     * Search for an element with one of the texts
     * @param textList set of texts to search for
     * @returns The first element id or `undefined` if no element was found
     */
    async findByAnyText(textList: string[]): Promise<ElementId | undefined> {
        switch (this.platform) {
            case 'Android': {
                const comparisonList = textList.map(text => `@text='${text}'`);
                const xpath = `//*[${comparisonList.join(' or ')}]`;
                const element = await this.findElement('xpath', xpath);
                return element;
            }
            case 'iOS':
                throw new Error('Not yet implemented');
                break;
        }
    }

    /**
     * Click first element with given text
     * @param text text to search for
     * @throws if no element is found
     */
    @retryIfStaleElementException
    async clickByText(text: string): Promise<void> {
        const element = await this.findByText(text);
        if (!element) {
            throw new Error(`${JSON.stringify({ text })} not found, cannot click`);
        }
        await this.click(element!);
    }

    /**
     * Click last element with given text 
     * @param text text to search for
     * @throws if no element is found
     */
    @retryIfStaleElementException
    async clickLastByText(text: string) {
        const element = await this.findLastByText(text);
        if (!element) {
            throw new Error(`${JSON.stringify({ text })} not found, cannot click`);
        }
        await this.click(element!);
    }

    /**
     * Click first element with any of the given texts
     * @param textList set of texts to search for
     * @throws if no element is found
     */
    @retryIfStaleElementException
    async clickByAnyText(textList: string[]) {
        const element = await this.findByAnyText(textList);
        await this.click(element!); // Note: eventually find and click in a single operation to be robust against changing text?
    }

    /**
     * Click the given element
     * Prefer using one of the higher level click methods, as they have better retry logic
     * 
     * @param element an element id
     */
    async click(element: ElementId) {
        await this.client.elementClick(element);
    }


    /**
     * Query if an element is "enabled"
     * @param element an element id
     * @returns true or false
     */
    async isEnabled(element: ElementId): Promise<boolean> {
        return this.client.isElementEnabled(element);
    }

    /**
     * Query if an element is "checked"
     * @param element an element id
     * @returns true or false
     */
    async isChecked(element: string): Promise<boolean> {
        switch (this.platform) {
            case 'Android': {
                const checked = await this.client.getElementAttribute(element, 'checked');
                return checked === 'true';
            }
            case 'iOS':
                throw new Error('Not implemented');
        }
    }

    /**
     * Query if an element with a given accessibility id is enabled
     * @param accessibilityId an accessibility id
     * @returns true if the element is found AND enabled, false otherwise
     */
    @retryIfStaleElementException
    async isEnabledButtonByA11y(accessibilityId: string): Promise<boolean> {
        const element = await this.findByA11y(accessibilityId);
        const isEnabled = element ? await this.isEnabled(element) : false;
        return isEnabled;
    }

    /**
     * Query if the last element with a given accessibility id is enabled
     * @param accessibilityId an accessibility id
     * @returns true if the element is found AND enabled, false otherwise
     */
    @retryIfStaleElementException
    async isEnabledLastButtonByA11y(accessibilityId: string): Promise<boolean> {
        const element = await this.findLastByA11y(accessibilityId);
        const isEnabled = element ? await this.isEnabled(element) : false;
        return isEnabled;
    }

    async findInputs() {
        return this.findElements('xpath', '//android.widget.EditText');
    }

    /**
     * Find an input element with a given accessibility id
     * @param accessibilityId an accessibility id
     * @returns The input element id or `undefined` if no element was found
     */
    async findInputByA11y(accessibilityId: string, secure: boolean): Promise<ElementId | undefined> {
        switch (this.platform) {
            case 'Android': {
                // Note: apparently, we cannot sendKeys() on the pressable, so we need to find the EditText within
                const pressable = await this.findByA11y(accessibilityId);
                if (!pressable) {
                    throw new Error(`Unable to findInputByA11y("${accessibilityId}")`);
                }
                return this.findElementFromElement(pressable!, 'xpath', './/android.widget.EditText');
            }
            case 'iOS': {
                let inputType = secure ? "XCUIElementTypeSecureTextField" : "XCUIElementTypeTextField"
                // For some reason when there is multiple input elements on the same page,
                // once you enter something into one, it becomes impossible to find the others using just name, so we are forced to use xpath
                return this.findElement("xpath", `//${inputType}[@name="${accessibilityId}"]`)
            }
        }
    }

    /**
     * Enter text into the given input element without clicking "enter"
     * @param element an element id
     * @param text the text to enter
     */
    async type(element: ElementId, text: string): Promise<void> {
        await this.client.elementSendKeys(element, text);
    }

    /**
     * Delete the text from the given input element
     * @param element an element id
     */
    async clear(element: ElementId): Promise<void> {
        await this.client.elementClear(element);
        if (this.platform === 'iOS') {
            // Note: line feed sends a RETURN key press, "leaving" the field on iOS
            await this.type(element, '\n');
        }
    }

    /**
     * Clear the text from an input element
     * @param accessibilityId an accessibility id to search for
     */
    @retryIfStaleElementException
    async clearByA11y(accessibilityId: string): Promise<void> {
        // Note: on iOS there are (occasionally) multiple elements with a given accessibilityId, so we pick the last one
        const elements = await this.findElements('accessibility id', accessibilityId);
        const element = elements[elements.length - 1];
        await this.clear(element);
    }

    /**
     * Enter text into the given input element followed by "enter"
     * Prefer using one of the more high level enterBy methods, as those have better retry logic
     * @param element an element id
     * @param text the text to enter
     */
    async enter(element: string, text: string): Promise<void> {
        // make sure to send only one elementSendKeys command to avoid stale element problems
        if (this.platform === 'iOS') {
            // Note: line feed sends a RETURN key press, closing the keyboard popup on iOS
            await this.type(element, text + '\n');
        } else {
            await this.type(element, text);
        }
    }

    /**
     * Enter text into an input element followed by "enter"
     * @param accessibilityId an accessibility id to search for
     * @param text the text to enter
     */
    @retryIfStaleElementException
    async enterByA11y(accessibilityId: string, text: string, options = { secure: false }): Promise<void> {
        const element = await this.findInputByA11y(accessibilityId, options.secure);
        await this.enter(element!, text);
    }

    /**
     * Wait for a fixed amount of time
     * @param timeout number of milliseconds to wait
     */
    async wait(timeout: number): Promise<void> {
        // Note: not using delayPromise from util.ts to avoid dependency on app source
        return new Promise(resolve => setTimeout(resolve, timeout));
    }

    /**
      * Search for an element with the given accessibility id
      * @param accessibilityId accessibility id to search for
      * @returns The first element id or `undefined` if no element was found
      */
    async findByA11y(accessibilityId: string): Promise<ElementId | undefined> {
        return this.findElement('accessibility id', accessibilityId);
    }

    async findButtonByA11y(accessibilityId: string): Promise<ElementId | undefined> {
        return (this.platform === "Android" ?
            (await this.findByA11y("Next Button"))! :
            (await this.findElement("xpath", `//XCUIElementTypeButton[@name="Next Button"]`)))
    }

    /**
      * Search for last element with the given accessibility id
      * @param accessibilityId accessibility id to search for
      * @returns The last element id or `undefined` if no element was found
      */
    async findLastByA11y(accessibilityId: string) {
        const elementList = await this.findElements('accessibility id', accessibilityId);
        const element = elementList[elementList.length - 1];
        return element;
    }

    /**
      * Search for an element with one of the the given accessibility ids
      * @param accessibilityIdList set of accessibility ids to search for
      * @returns The first element id or `undefined` if no element was found
      */
    async findByAnyA11y(accessibilityIdList: string[]): Promise<ElementId | undefined> {
        switch (this.platform) {
            case 'Android': {
                const comparisonList = accessibilityIdList.map(aId => `@content-desc='${aId}'`);
                const xpath = `//*[${comparisonList.join(' or ')}]`;
                const element = await this.findElement('xpath', xpath);
                return element;
            }
            case 'iOS':
                throw new Error('Not yet implemented');
                break;
        }
    }

    /**
     * Click first element with given accessibility id
     * @param accessibilityId an accessibility id
     * @throws if no element is found
     */
    @retryIfStaleElementException
    async clickByA11y(accessibilityId: string): Promise<void> {
        const element = await this.findByA11y(accessibilityId);
        if (!element) {
            throw new Error(`${JSON.stringify({ accessibilityId })} not found, cannot click`);
        }
        await this.click(element!);
    }

    @retryIfStaleElementException
    async clickButtonByA11y(accessibilityId: string): Promise<void> {
        const element = await this.findButtonByA11y(accessibilityId)
        await this.click(element!)
    }
    /**
     * Click last element with given accessibility id
     * @param accessibilityId an accessibility id
     * @throws if no element is found
     */
    @retryIfStaleElementException
    async clickLastByA11y(accessibilityId: string) {
        const elementList = await this.findElements('accessibility id', accessibilityId);
        const element = elementList[elementList.length - 1];
        if (!element) {
            throw new Error(`${JSON.stringify({ accessibilityId })} not found, cannot click`);
        }
        await this.click(element);
    }

    /**
     * Get text of given element
     * @param element an element id
     * @returns text of element if found, null if no element or element became stale
     */
    async textOf(element: ElementId): Promise<string | null> {
        if (element) {
            try {
                const attribute = this.platform === 'Android' ? 'text' : 'value';
                const text = await this.client.getElementAttribute(element, attribute);
                return text;
            } catch (err) {
                if ((err as Error).name === 'stale element reference') {
                    console.log('(textOfElement: stale element, returning null)')
                    return null;
                }
                throw err;
            }
        } else {
            return null;
        }
    }

    /**
     * Get text of element found by given strategy and selector
     * @param using a selector strategy
     * @param value a valid selector of the given strategy
     * @returns text of element if found, null if not found or element became stale
     */
    @retryIfStaleElementException
    async textOfElement(using: SelectorStrategy, value: string): Promise<string | null> {
        const element = await this.findElement(using, value);
        const text = await this.textOf(element!);
        return text;
    }

    async switchStateOf(element: string) {
        const switchText = await this.textOf(element);
        switch (this.platform) {
            case 'Android':
                return switchText === 'ON';
                break;
            case 'iOS':
                return switchText === '1';
                break;
        }
    }

    /**
     * Drag (press, move, release) between two points on the screen
     * @param fromPoint x and y coordinate to press
     * @param toPoint x and y coordinate to release
     */
    async dragPosition(fromPoint: WebdriverIO.DragAndDropCoordinate, toPoint: WebdriverIO.DragAndDropCoordinate): Promise<void> {
        if (this.platform === 'Android') {
            const actions = [
                { action: 'press', options: fromPoint },
                { action: 'wait', options: { duration: 500 } },
                { action: 'moveTo', options: { ...toPoint, duration: 500 } },
                { action: 'release' }
            ];
            await this.client.touchPerform(actions);
        } else {
            // Note: for some reason touchPerform does not work on iOS in this case, so we use a native script instead
            const args = {
                duration: 0.5,
                fromX: fromPoint.x,
                fromY: fromPoint.y,
                toX: toPoint.x,
                toY: toPoint.y,
            };
            await this.client.execute('mobile: dragFromToForDuration', args);
        }
    }

    async sendDigit(digit: number) {
        assert.ok(digit >= 0 && digit <= 9);
        switch (this.platform) {
            case 'Android':
                await this.client.sendKeyEvent((digit + 7).toString());
                break;
            case 'iOS':
                throw new Error('Not implemented yet');
        }
    }

    /**
     * Send a sequence of digits to the app via the numeric keyboard
     * @param digits sequence of digits
     */
    async sendDigits(digits: string): Promise<void> {
        // Note: the keyboard must already be open
        for (const digit of digits) {
            switch (this.platform) {
                case 'Android':
                    await this.sendDigit(parseInt(digit));
                    break;
                case 'iOS':
                    await this.clickByA11y(digit);
                    break;
            }
            await this.wait(500); // Note: defense against digits received in wrong order
        }
    }

    async isDisplayed(element: string) {
        if (element) {
            return await this.client.isElementDisplayed(element);
        } else {
            return false;
        }
    }

    /**
     * Swipe up to scroll the page down until an element becomes visible
     * @param accessibilityId an accessibility id to search for
     * @throws if element is not found with 10 scrolls
     */
    async scrollToA11y(accessibilityId: string) {
        let scrollAttempt = 0;
        while (true) { // eslint-disable-line no-constant-condition
            const element = await this.findByA11y(accessibilityId)
            if (element) break;
            if (scrollAttempt === 10) {
                throw new Error(`Failed to scroll to "${accessibilityId}"`);
            }
            await this.scrollDown();
            ++scrollAttempt;
        }
    }

    /**
     * Swipe up to scroll the page down half a screen size
     */
    async scrollDown() {
        const { height, width } = await this.client.getWindowSize();
        const x = width / 2;
        const fromPoint = { x, y: 0.75 * height };
        const toPoint = { x, y: 0.25 * height };
        await this.dragPosition(fromPoint, toPoint); // Note: scroll half the screen size
        // TODO: why does this not work?
        // const xoffset = 0;
        // const yoffset = height / 2; // Note: scroll half the screen size
        // await this.client.touchScroll(xoffset, yoffset);
    }

    @retryIfStaleElementException
    async clickByTextAndIndex(text: string, index: number): Promise<void> {
        const elementList = await this.findAllByText(text);
        const element = elementList[index];
        if (!element) {
            throw new Error(`No element at index ${index} of list with ${elementList.length} elements with text ${text}`);
        }
        await this.click(element);
    }

}
