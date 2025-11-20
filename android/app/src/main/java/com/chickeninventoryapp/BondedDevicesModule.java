package com.chickeninventoryapp;

import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.WritableNativeArray;
import com.facebook.react.bridge.WritableNativeMap;

import java.util.Set;

public class BondedDevicesModule extends ReactContextBaseJavaModule {

    public BondedDevicesModule(ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @Override
    public String getName() {
        return "BondedDevicesModule";
    }

    @ReactMethod
    public void getBondedDevices(Promise promise) {
        try {
            BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
            if (adapter == null) {
                promise.reject("NO_BT", "Bluetooth no disponible");
                return;
            }

            Set<BluetoothDevice> paired = adapter.getBondedDevices();
            WritableNativeArray arr = new WritableNativeArray();

            for (BluetoothDevice dev : paired) {
                WritableNativeMap map = new WritableNativeMap();
                map.putString("name", dev.getName());
                map.putString("address", dev.getAddress());
                arr.pushMap(map);
            }

            promise.resolve(arr);

        } catch (Exception e) {
            promise.reject("ERROR", e.getMessage());
        }
    }
}
