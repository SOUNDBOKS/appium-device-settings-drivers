import { retry, retryIf, retryUntil, retryUntilWithIntermediateStep, retryWithIntermediateStep } from "@soundboks/again";
import { isStaleElementException, PhoneDriver, retryIfStaleElementException } from "../PhoneDriver";
import { ISettingsDriver, PairDeviceOptions, Permission, WebdriverBrowser } from "../types";


/**
 * iOS Preference Driver
 * 
 * 
 * 
 * @note The excessive amount of short waits is mostly to deal with old iOS devices
 *       Without them, quite often a click will happen, but have no effect and fail silently.
 */


export default class iOSSettingsDriver extends PhoneDriver implements ISettingsDriver {
    client: WebdriverBrowser

    constructor(client: WebdriverBrowser) {
        super(client, "iOS")
        this.client = client
    }


    async allowPermission(permission: Permission): Promise<void> {
        switch (permission) {
            case Permission.Bluetooth:
                await this.clickByA11y("OK")
                break;
            case Permission.Notifications:
                await this.clickByA11y("Allow")
                break;
            default:
                throw new Error("Unknown permission request: " + permission)
        }
    }

    async disconnectDevice(deviceLabel: string): Promise<void> {
        await retryIf(async () => await this.click((await this.findDeviceDetailsButton(deviceLabel))!), isStaleElementException)
        await new Promise(resolve => setTimeout(resolve, 500))
        await this.clickByA11y("Disconnect")
        await new Promise(resolve => setTimeout(resolve, 500))
        await this.clickByA11y("Bluetooth")
    }

    @retryIfStaleElementException
    async connectDevice(deviceLabel: string): Promise<void> {
        await retryUntil(async () => {
            await this.click((await this.findByIncludesText(deviceLabel))!)
            return this.isDeviceConnected(deviceLabel)
        })
    }

    async pairDevice(deviceLabel: string, options: PairDeviceOptions): Promise<void> {
        await retryWithIntermediateStep(async () => {
            await retryWithIntermediateStep(async () => {
                await retryWithIntermediateStep(async () => {
                    await retryIf(
                        async () => this.click((await this.findByIncludesText(deviceLabel))!),
                        isStaleElementException
                    )
                }, async () => this.scrollDown())
            }, async () => this.ensureBluetoothReenabled(), { waitTime: 5000 })

            await this.withPatience(150000, async () => {
                if (!await this.isDeviceConnected(deviceLabel)) {
                    throw new Error("Failed to assert that device is connected after pairing")
                }
            })
        }, async () => {
            if (await this.findByText("Pairing Unsuccessful")) {
                await this.findByText("OK")
            } else {
                throw new Error("Pairing failed for an unknown reason")
            }
        })

    }

    async ensureDeviceUnpaired(deviceLabel: string): Promise<void> {
        await this.withPatience(20000, async () => {
            const deviceDetailsButton = await this.findDeviceDetailsButton(deviceLabel);

            if (deviceDetailsButton) {
                await retryIf(async () => this.click((await this.findDeviceDetailsButton(deviceLabel))!), isStaleElementException)
                await new Promise(resolve => setTimeout(resolve, 500))
                await this.clickByA11y('Forget This Device');
                await new Promise(resolve => setTimeout(resolve, 500))
                await this.clickByA11y('Forget Device'); // Note: setting autoAcceptAlerts to true will click "cancel" here instead
                // Note: re-enter Bluetooth settings to ensure it becomes visible again
                await new Promise(resolve => setTimeout(resolve, 500))
                await this.clickByA11y('Settings');
                await new Promise(resolve => setTimeout(resolve, 500))
                await this.clickByA11y('Bluetooth');

                // Note: wait until it becomes visible again for re-pairing
                await retryUntilWithIntermediateStep(async () => Boolean(await this.findByIncludesText(deviceLabel)), async () => {
                    await this.ensureBluetoothReenabled()
                });
            }
        })
    }

    @retryIfStaleElementException
    async ensureAllDevicesUnpaired(): Promise<void> {
        while (true) {
            let detailsButton = await this.findDeviceDetailsButton("");

            if (detailsButton) {
                await this.ensureDeviceUnpaired("")
            } else {
                return;
            }
        }
    }

    async findDeviceDetailsButton(deviceLabel: string) {
        return this.findElement("xpath", `//*[contains(@label, '${deviceLabel}')]/*[@label='More Info']`)
    }

    async isDeviceConnected(deviceLabel: string): Promise<boolean> {
        const getBluetoothConnectionText = async () => {
            return this.textOfElement("xpath", `//XCUIElementTypeStaticText[contains(@value, "${deviceLabel}")]/following-sibling::XCUIElementTypeStaticText`)
        }

        return await getBluetoothConnectionText() === "Connected"
    }

    async activateSettings(): Promise<void> {
        await this.client.activateApp("com.apple.Preferences")
    }

    async killSettings(): Promise<void> {
        await this.client.terminateApp("com.apple.Preferences")
    }

    async navigateBluetooth(): Promise<void> {
        await this.clickByA11y("Bluetooth")
    }

    async ensureBluetoothReenabled(): Promise<void> {
        await this.ensureBluetoothDisabled()
        await this.ensureBluetoothEnabled()
    }

    async ensureBluetoothEnabled(): Promise<void> {
        const bluetoothIsOffSwitch = await this.findElement(
            'xpath',
            "//XCUIElementTypeSwitch[@name='Bluetooth' and @value='0']"
        );

        if (bluetoothIsOffSwitch) {
            await this.click(bluetoothIsOffSwitch);
        }

        if (!(await this.findElement(
            'xpath',
            "//XCUIElementTypeSwitch[@name='Bluetooth' and @value='1']"
        ))) {

            throw new Error("Failed to assert that bluetooth is enabled")
        }
    }


    async ensureBluetoothDisabled(): Promise<void> {
        const bluetoothIsOnSwitch = await this.findElement(
            'xpath',
            "//XCUIElementTypeSwitch[@name='Bluetooth' and @value='1']"
        );

        if (bluetoothIsOnSwitch) {
            await this.click(bluetoothIsOnSwitch);
        }

        if (!(await this.findElement(
            'xpath',
            "//XCUIElementTypeSwitch[@name='Bluetooth' and @value='0']"
        ))) {

            throw new Error("Failed to assert that bluetooth is disabled")
        }
    }

}