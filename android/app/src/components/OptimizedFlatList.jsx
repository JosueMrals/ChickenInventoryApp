import React from "react";
import { FlatList } from "react-native";
import useOptimizedList from "../utils/useOptimizedList";

export default function OptimizedFlatList({ data, renderItem, keyBuilder }) {
  const cfg = useOptimizedList(keyBuilder);

  return (
    <FlatList
      {...cfg}
      data={data}
      renderItem={renderItem}
    />
  );
}
