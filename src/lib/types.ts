import * as WebdriverIO from "webdriverio"

export type WebdriverBrowser = WebdriverIO.Browser<'async'>

export class PairingFailure extends Error {
    constructor(deviceLabel: string) {
        super("Failed to pair to device: " + deviceLabel)
        Object.setPrototypeOf(this, PairingFailure.prototype)
    }
}

export type PairDeviceOptions = {
    /// Pin to use if the device requires one
    pincode?: string;
    /// If set, will throw if pairing does not require a pin
    expectPincode?: boolean;
}

export enum Permission {
    Notifications,
    Bluetooth,
}

export interface ISettingsDriver {
    activateSettings(): Promise<void>;
    killSettings(): Promise<void>;
    navigateBluetooth(): Promise<void>;
    ensureBluetoothEnabled(): Promise<void>;
    ensureBluetoothReenabled(): Promise<void>;
    ensureBluetoothDisabled(): Promise<void>;
    ensureDeviceUnpaired(deviceLabel: string): Promise<void>;
    ensureAllDevicesUnpaired(): Promise<void>;
    
    pairDevice(deviceLabel: string, options?: PairDeviceOptions): Promise<void>;
    isDeviceConnected(deviceLabel: string): Promise<boolean>;
    disconnectDevice(deviceLabel: string): Promise<void>;
    connectDevice(deviceLabel: string): Promise<void>;

    allowPermission(permission: Permission): Promise<void>;
}



export enum Brand {
    LG = "LG",
    iPhone = "iPhone",
    Huawei = "Huawei",
    Samsung = "Samsung",
    OnePlus = "OnePlus",
    Google = "Google",
}