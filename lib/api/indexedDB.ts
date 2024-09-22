import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface IData {
  id?: number;
  src: string;
  translateSrc?: string;
  status: number; //-2.图片上传失败 -1.翻译失败 1.完成翻译 2.完成图片上传 3.排队中 4.图片上传中
  requestId?: string;
  message?: string;
  createdAt: string;
}

const DB_NAME = 'ai-image-translation-database';
const STORE_NAME = 'ai-image-translation-store';

// 每页的条目数
const PAGE_SIZE = 50;

interface MyDB extends DBSchema {
  [STORE_NAME]: {
    key: number;
    value: IData
  };
}

export async function initDB(): Promise<IDBPDatabase<MyDB>> {
  const db = await openDB<MyDB>(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    },
  });
  return db;
}

export async function addData(data: IData): Promise<IData> {
  delete data.id;
  const db = await initDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  // await tx.objectStore(STORE_NAME).add(data);
  const store = tx.objectStore(STORE_NAME);
  // await tx.done;

  // 返回插入数据后的主键值
  const id = await store.add(data);
  await tx.done;

  // 返回带有新生成 id 的数据
  return { ...data, id };
}

// 分页
export async function getData(quantity: number = 50): Promise<{ [key: number]: IData }> {
  const db = await initDB();
  const store = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME);
  const allRecords = await store.getAll();

  //@ts-ignore
  allRecords.sort((a, b) => b.id - a.id);
  const endIndex = quantity + PAGE_SIZE;
  // 获取分页后的数据
  const paginatedData = allRecords.slice(0, endIndex);
   // 使用 Map 来保留降序插入顺序
   const result = new Map<number, IData>();
   paginatedData.forEach(item => {
     if (item.id !== undefined) {
       result.set(item.id, item);
     }
   });
 
   // 将 Map 转换为普通对象返回
   return Object.fromEntries(result);
}

export async function updateData(id: number, updatedData: Partial<IData>): Promise<void> {
  const db = await initDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);

  // 获取现有数据
  const existingData = await store.get(id);

  if (!existingData) {
    throw new Error(`Data with id ${id} not found`);
  }

  // 更新数据，保留现有字段，更新传入的字段
  const newData = { ...existingData, ...updatedData, id };

  // 使用 put 方法更新数据
  await store.put(newData);
  await tx.done;
}

// 新增的删除功能
export async function deleteData(id: number): Promise<void> {
  const db = await initDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  await tx.objectStore(STORE_NAME).delete(id);
  await tx.done;
}