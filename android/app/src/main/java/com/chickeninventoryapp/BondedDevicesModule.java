package com.chickeninventoryapp;

import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothSocket;
import android.util.Base64;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.WritableNativeArray;
import com.facebook.react.bridge.WritableNativeMap;

import java.io.IOException;
import java.io.OutputStream;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class BondedDevicesModule extends ReactContextBaseJavaModule {
    private BluetoothSocket mmSocket;
    private static final UUID SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");
    private final ExecutorService executorService = Executors.newSingleThreadExecutor();

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

            if (!adapter.isEnabled()) {
                promise.reject("BT_OFF", "Bluetooth apagado");
                return;
            }

            Set<BluetoothDevice> paired = adapter.getBondedDevices();
            WritableNativeArray arr = new WritableNativeArray();

            if (paired != null && !paired.isEmpty()) {
                for (BluetoothDevice dev : paired) {
                    String name = dev.getName();
                    String address = dev.getAddress();

                    WritableNativeMap map = new WritableNativeMap();
                    map.putString("name", name != null ? name : "Desconocido");
                    map.putString("address", address != null ? address : "00:00:00:00:00:00");
                    arr.pushMap(map);
                }
            }
            promise.resolve(arr);
        } catch (Exception e) {
            promise.reject("ERROR_GET_BONDED", e.toString());
        }
    }

    @ReactMethod
    public void connect(String address, Promise promise) {
        executorService.execute(() -> {
            try {
                BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
                BluetoothDevice device = adapter.getRemoteDevice(address);

                if (mmSocket != null) {
                    try {
                        mmSocket.close();
                    } catch (Exception ignored) {}
                }

                // Standard SPP UUID
                try {
                    mmSocket = device.createRfcommSocketToServiceRecord(SPP_UUID);
                } catch (IOException e) {
                   // Fallback for some devices
                   try {
                       mmSocket = (BluetoothSocket) device.getClass().getMethod("createRfcommSocket", new Class[]{int.class}).invoke(device, 1);
                   } catch (Exception ignored){}
                }

                if (mmSocket != null) {
                   mmSocket.connect();
                   promise.resolve(true);
                } else {
                   promise.reject("CONNECT_FAIL", "No socket created");
                }

            } catch (Exception e) {
                try {
                    mmSocket.close();
                } catch (Exception ignored) {}
                mmSocket = null;
                promise.reject("CONNECT_ERROR", e.getMessage());
            }
        });
    }

    @ReactMethod
    public void print(String base64Data, Promise promise) {
        if (mmSocket == null || !mmSocket.isConnected()) {
            promise.reject("NOT_CONNECTED", "Impresora no conectada");
            return;
        }

        executorService.execute(() -> {
            try {
                OutputStream outputStream = mmSocket.getOutputStream();
                byte[] decodedBytes = Base64.decode(base64Data, Base64.DEFAULT);

                outputStream.write(decodedBytes);
                outputStream.flush();
                promise.resolve(true);
            } catch (Exception e) {
                promise.reject("PRINT_ERROR", e.getMessage());
            }
        });
    }

    @ReactMethod
    public void disconnect(Promise promise) {
        executorService.execute(() -> {
            try {
                if (mmSocket != null) {
                    mmSocket.close();
                    mmSocket = null;
                }
                promise.resolve(true);
            } catch (Exception e) {
                promise.reject("DISCONNECT_ERROR", e.getMessage());
            }
        });
    }
}
