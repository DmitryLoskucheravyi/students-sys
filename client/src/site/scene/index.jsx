/*
 * Точка входу 3D для карток курсів. Вантажиться окремим чанком лише в браузері й лише коли 3D дозволене
 * (direction.jsx: не «менше руху», не економія трафіку, є WebGL2, більше 2 ядер).
 */
import { View } from '@react-three/drei';
import SceneCanvas from './SceneCanvas.jsx';
import SceneRig from './SceneRig.jsx';
import KeysScene from './scenes/KeysScene.jsx';
import BlocksScene from './scenes/BlocksScene.jsx';
import BlobScene from './scenes/BlobScene.jsx';
import IslandScene from './scenes/IslandScene.jsx';
import LayersScene from './scenes/LayersScene.jsx';
import TilesScene from './scenes/TilesScene.jsx';
import RequestScene from './scenes/RequestScene.jsx';

/** target — куди дивиться камера; size — [ширина, висота] сцени у світі, щоб вписати її в будь-які пропорції слота. */
export const SCENES = {
  keys: { C: KeysScene, target: [0, 0.75, 0], size: [3.9, 2.4] },
  blocks: { C: BlocksScene, target: [0, 1.2, 0], size: [3.0, 3.0] },
  blob: { C: BlobScene, target: [0, 1.15, 0], size: [3.4, 2.9] },
  island: { C: IslandScene, target: [0, 0.75, 0], size: [3.2, 2.7] },
  layers: { C: LayersScene, target: [0, 0.7, 0], size: [3.6, 2.4] },
  tiles: { C: TilesScene, target: [0, 0.45, 0], size: [4.0, 2.3] },
  request: { C: RequestScene, target: [0, 0.95, 0], size: [3.9, 2.5] },
};

export function CardScene({ scene, look, face, tap, onReady }) {
  const s = SCENES[scene];
  if (!s) return null;
  const { C } = s;
  return (
    <View className="cc-view">
      <SceneRig target={s.target} size={s.size} onReady={onReady}>
        <C look={look} face={face} tap={tap} />
      </SceneRig>
    </View>
  );
}

export { SceneCanvas };
