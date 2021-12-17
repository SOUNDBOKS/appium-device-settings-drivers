import { ISettingsDriver, PairDeviceOptions, Permission } from "../types";



export default class iOSSettingsDriver implements ISettingsDriver {
    allowPermission(permission: Permission): Promise<void> {
        throw new Error("Method not implemented.");
    }
    disconnectDevice(deviceLabel: string): Promise<void> {
        throw new Error("Method not implemented.");
    }
    connectDevice(deviceLabel: string): Promise<void> {
        throw new Error("Method not implemented.");
    }
    pairDevice(deviceLabel: string, options: PairDeviceOptions): Promise<void> {
        throw new Error("Method not implemented.");
    }
    isDeviceConnected(deviceLabel: string): Promise<boolean> {
        throw new Error("Method not implemented.");
    }
    activateSettings(): Promise<void> {
        throw new Error("Method not implemented.");
    }
    navigateBluetooth(): Promise<void> {
        throw new Error("Method not implemented.");
    }
    ensureBluetoothEnabled(): Promise<void> {
        throw new Error("Method not implemented.");
    }
    ensureBluetoothReenabled(): Promise<void> {
        throw new Error("Method not implemented.");
    }
    ensureBluetoothDisabled(): Promise<void> {
        throw new Error("Method not implemented.");
    }
    ensureDeviceUnpaired(): Promise<void> {
        throw new Error("Method not implemented.");
    }

}