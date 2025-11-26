import { useCallback, useMemo } from "react";

export default function useOptimizedList(keyBuilder) {
  // keyBuilder: function that receives (item, index) and returns unique key

  const keyExtractor = useCallback(
    (item, index) => {
      try {
        return keyBuilder(item, index) || `row_${index}`;
      } catch {
        return `row_${index}`;
      }
    },
    [keyBuilder]
  );

  const getItemLayout = useCallback((data, index) => ({
    length: 70,       // altura promedio de los items
    offset: 70 * index,
    index
  }), []);

  const listConfig = useMemo(
    () => ({
      removeClippedSubviews: true,
      maxToRenderPerBatch: 15,
      updateCellsBatchingPeriod: 30,
      initialNumToRender: 10,
      windowSize: 10,
      keyExtractor,
      getItemLayout
    }),
    [keyExtractor, getItemLayout]
  );

  return listConfig;
}
