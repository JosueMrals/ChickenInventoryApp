import React from "react";
import { View, Dimensions } from "react-native";
import Svg, { Path, Circle, Rect } from "react-native-svg";

const { width } = Dimensions.get("window");
const CHART_HEIGHT = 180;
const CHART_WIDTH = width - 60;

export default function LineChartPRO({ data = [] }) {
  if (!data || data.length === 0) {
    return (
      <View style={{ height: CHART_HEIGHT, justifyContent: "center", alignItems: "center" }}>
        <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
          <Rect
            x="0"
            y="0"
            width={CHART_WIDTH}
            height={CHART_HEIGHT}
            fill="none"
            stroke="#E2E5EB"
            strokeDasharray="4 4"
            rx="8"
          />
        </Svg>
      </View>
    );
  }

  // Convertir datos a números
  const cleanData = data.map((v) => Number(v) || 0);

  const max = Math.max(...cleanData) || 1;
  const min = Math.min(...cleanData);

  const stepX = CHART_WIDTH / Math.max(1, cleanData.length - 1);
  const normalizeY = (value) =>
    CHART_HEIGHT - ((value - min) / (max - min || 1)) * CHART_HEIGHT;

  // Generar líneas suavizadas con curvas Bezier
  const generatePath = () => {
    let path = "";
    cleanData.forEach((value, index) => {
      const x = index * stepX;
      const y = normalizeY(value);
      if (index === 0) {
        path += `M ${x} ${y}`;
      } else {
        const prevX = (index - 1) * stepX;
        const prevY = normalizeY(cleanData[index - 1]);
        const cX = (prevX + x) / 2;
        path += ` C ${cX} ${prevY}, ${cX} ${y}, ${x} ${y}`;
      }
    });
    return path;
  };

  const linePath = generatePath();

  return (
    <View style={{ height: CHART_HEIGHT, overflow: "visible" }}>
      <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>

        {/* Líneas de fondo */}
        {[0.25, 0.5, 0.75].map((p, i) => (
          <Path
            key={i}
            d={`M0 ${CHART_HEIGHT * p} H${CHART_WIDTH}`}
            stroke="#E6EAF0"
            strokeWidth="1"
            strokeDasharray="6 6"
          />
        ))}

        {/* Línea principal */}
        <Path
          d={linePath}
          fill="none"
          stroke="#007AFF"
          strokeWidth="3"
        />

        {/* Puntos */}
        {cleanData.map((value, index) => {
          const x = index * stepX;
          const y = normalizeY(value);
          return (
            <Circle
              key={index}
              cx={x}
              cy={y}
              r="4"
              fill="#007AFF"
              stroke="#fff"
              strokeWidth="2"
            />
          );
        })}

      </Svg>
    </View>
  );
}
