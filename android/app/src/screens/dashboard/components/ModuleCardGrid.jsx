import React from 'react';
import { View } from 'react-native';
import ModuleCard from './ModuleCard';
import styles from '../styles/dashboardStyles';

/**
 * Componente para renderizar una grilla de ModuleCards con un layout personalizable.
 * @param {object} props
 * @param {Array<object>} props.modules - Un array con todos los módulos disponibles para el usuario.
 * @param {Array<Array<object>>} props.layout - Un array de filas, donde cada fila es un array de objetos de configuración de módulo.
 *                                                Ej: [[{ key: 'quick-sale', size: 2 }, { key: 'pre-sale', size: 1 }]]
 * @param {object} props.anim - Valor animado para las tarjetas.
 * @param {object} props.user - Objeto de usuario.
 * @param {string} props.role - Rol del usuario.
 */
const ModuleCardGrid = ({ modules, layout, anim, user, role }) => {
  if (!modules || !layout) {
    return null;
  }

  const modulesByKey = modules.reduce((map, module) => {
    map[module.key] = module;
    return map;
  }, {});

  return (
    <View style={styles.modulesContainer}>
      {layout.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.moduleRow}>
          {row.map((moduleConfig) => {
            const module = modulesByKey[moduleConfig.key];
            if (!module) return null;

            const moduleContainerStyle = [
              styles.moduleCardWrapper,
              { flex: moduleConfig.size || 1 },
            ];

            return (
              <View key={moduleConfig.key} style={moduleContainerStyle}>
                <ModuleCard
                  item={module}
                  anim={anim}
                  user={user}
                  role={role}
                />
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
};

export default ModuleCardGrid;
