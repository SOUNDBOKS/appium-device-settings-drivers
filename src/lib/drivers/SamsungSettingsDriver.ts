import { retryIf, retryUntil, retryWithIntermediateStep } from "@soundboks/again";
import { SemVer } from "semver";
import { isStaleElementException, PhoneDriver, retryIfStaleElementException } from "../PhoneDriver";
import { ISettingsDriver, PairDeviceOptions, PairingFailure, Permission, WebdriverBrowser } from "../types";

/**
 * Samsung Settings Driver
 * 
 * Tested for:
 *  Samsung S21 Android Version 11
 *  Samsung S9 Android Version 10
 */

export default class SamsungSettingsDriver extends PhoneDriver implements ISettingsDriver {
    client: WebdriverBrowser
    platformVersion: SemVer

    constructor(client: WebdriverBrowser, platformVersion: SemVer) {
        super(client, "Android")
        this.client = client
        this.platformVersion = platformVersion
    }

    async allowPermission(permission: Permission): Promise<void> {
        switch (permission) {
            default:
                await this.click((await this.findElement("id", "com.android.permissioncontroller:id/permission_allow_foreground_only_button"))!)
        }
    }

    async disconnectDevice(deviceLabel: string): Promise<void> {
        if (this.platformVersion.major >= 11) {
            await this.click((await this.findDeviceDetailsButton(deviceLabel))!)
            await this.clickByText("Disconnect")
            await this.click((await this.findElement("xpath", "//*[@content-desc='Navigate up']"))!)
        } else {
            await this.click((await this.findByIncludesText(deviceLabel))!)
        }
    }

    @retryIfStaleElementException
    async connectDevice(deviceLabel: string): Promise<void> {
        await this.click((await this.findByIncludesText(deviceLabel))!)
    }

    async pairDevice(deviceLabel: string, options?: PairDeviceOptions): Promise<void> {
        await retryWithIntermediateStep(async () => {
            await retryWithIntermediateStep(async () => {
                await retryIf(
                    async () => this.click((await this.findByIncludesText(deviceLabel))!),
                    isStaleElementException
                )
            }, () => this.scrollDown())
        }, () => this.ensureBluetoothReenabled(), { waitTime: 5000 })

        await this.withPatience(15000, async () => {
            if (await this.findByText("Usually 0000 or 1234")) {
                const [pinInput] = await this.findInputs()
                await this.type(pinInput, options?.pincode || "0000")
                await this.clickByText("OK")
            } else {
                if (options?.expectPincode) throw new Error("Expected to be asked for a pincode")

                if (this.platformVersion.major >= 11) {
                    await this.clickByText("Pair")
                } else {
                    await this.clickByText("OK")
                }
            }
        })

        if (await this.findByIncludesText("incorrect PIN")) {
            throw new PairingFailure(deviceLabel)
        }
        if (!(await this.findDeviceDetailsButton(deviceLabel))) {
            throw new Error("Failed to assert that device is now paired")
        }
    }

    async isDeviceConnected(deviceLabel: string): Promise<boolean> {
        return !!(await this.findElement('xpath', `//*[contains(@text,"${deviceLabel}")]/..//*[@text="Connected for audio"]`))
    }

    async findDeviceDetailsButton(label: string) {
        return this.findElement('xpath', `//*[contains(@text,"${label}")]/../../..//*[contains(@content-desc, "Device settings")]`);
    }

    async ensureDeviceUnpaired(deviceLabel: string): Promise<void> {
        const deviceDetailsButton = await this.findDeviceDetailsButton(deviceLabel)
        if (deviceDetailsButton) {
            await this.click(deviceDetailsButton)
            await this.clickByText("Unpair")
        }
    }

    @retryIfStaleElementException
    async ensureAllDevicesUnpaired(): Promise<void> {
        while(true) {
            let detailsButton = await this.findDeviceDetailsButton("");

            if (detailsButton) {
                await this.ensureDeviceUnpaired("")
            } else {
                return;
            }
        }
    }

    async navigateBluetooth(): Promise<void> {
        await this.scrollUp();
        await this.clickByText("Connections")
        await this.clickByText("Bluetooth")
    }

    async activateSettings(): Promise<void> {
        await this.client.activateApp("com.android.settings")
    }

    async killSettings(): Promise<void> {
        await this.client.terminateApp("com.android.settings")
    }

    @retryIfStaleElementException
    async ensureBluetoothEnabled(): Promise<void> {
        const bluetoothIsOffSwitch = await this.findElement(
            'xpath',
            "//android.widget.Switch[@checked='false']"
        );

        if (bluetoothIsOffSwitch) {
            await this.click(bluetoothIsOffSwitch)
        }

        if (!(await this.findElement(
            'xpath',
            "//android.widget.Switch[@checked='true']"
        ))) {
            throw new Error("Failed to assert that bluetooth is enabled")
        }
    }

    async ensureBluetoothReenabled(): Promise<void> {
        await this.ensureBluetoothDisabled()
        await this.ensureBluetoothEnabled()
    }

    @retryIfStaleElementException
    async ensureBluetoothDisabled(): Promise<void> {
        let bluetoothIsOnSwitch = await this.findElement(
            'xpath',
            "//android.widget.Switch[@checked='true']"
        );

        if (bluetoothIsOnSwitch) {
            await this.click(bluetoothIsOnSwitch)
        }

        if (!(await this.findElement(
            'xpath',
            "//android.widget.Switch[@checked='false']"
        ))) {
            throw new Error("Failed to assert that bluetooth is disabled")
        }
    }

}