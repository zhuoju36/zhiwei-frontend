import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'

/** 模型加载：GLB/GLTF/OBJ 统一封装 */
export class ModelLoader {
  private gltfLoader: GLTFLoader
  private objLoader: OBJLoader

  constructor() {
    this.gltfLoader = new GLTFLoader()
    const dracoLoader = new DRACOLoader()
    dracoLoader.setDecoderPath('/draco/') // 静态资源路径
    this.gltfLoader.setDRACOLoader(dracoLoader)

    this.objLoader = new OBJLoader()
  }

  async loadGLB(url: string): Promise<THREE.Group> {
    return new Promise((resolve, reject) => {
      this.gltfLoader.load(
        url,
        (gltf) => {
          const model = gltf.scene
          // 遍历并提取 userData 中的构件信息
          model.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              child.userData.ifcGuid = child.userData.ifc_guid || null
              child.userData.pointIds = child.userData.point_ids || []
            }
          })
          resolve(model)
        },
        undefined,
        reject,
      )
    })
  }

  async loadOBJ(url: string): Promise<THREE.Group> {
    return new Promise((resolve, reject) => {
      // OBJ 无 userData，需外部传入映射
      this.objLoader.load(url, resolve, undefined, reject)
    })
  }
}
