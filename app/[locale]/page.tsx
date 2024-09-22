'use client'
import ky from 'ky'
import dayjs from 'dayjs';
import Image from 'next/image';
import { v4 as uuidV4 } from 'uuid';
import toast from 'react-hot-toast';
import { GoDownload } from "react-icons/go";
import { Button } from '@/components/ui/button';
import { Footer } from '@/app/components/footer';
import { MdDeleteOutline } from "react-icons/md";
import { useTranslation } from '@/app/i18n/client';
import { useLogin } from '@/app/hooks/use-login';
import { useEffect, useRef, useState } from 'react';
import Masonry, { BreakPoints } from 'react-layout-masonry';
import { PhotoProvider, PhotoView } from 'react-photo-view';
import { SkFadingCircle } from '../components/SkFadingCircle';
import { addData, deleteData, getData, updateData } from '@/lib/api/indexedDB';
import { MdOutlineDriveFolderUpload } from "react-icons/md";
import { IoWarningSharp } from "react-icons/io5";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import logo_302 from '@/public/images/logo.png'
import { useUserStore } from '../stores/use-user-store';
import { emitter } from '@/lib/mitt';

interface IDataSource {
  id?: number;
  src: string;
  translateSrc?: string;
  status: number; //-2.图片上传失败 -1.翻译失败 1.完成翻译 2.完成图片上传 3.排队中 4.图片上传中
  requestId?: string;
  message?: string;
  createdAt: string;
}

export default function Home({ params: { locale } }: { params: { locale: string } }) {
  const { t } = useTranslation(locale)
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  // const pageRef = useRef(50);
  const translateIds = useRef<number[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [dataSource, setDataSource] = useState<{ [key: number]: IDataSource }>({});
  const [columns, setColumns] = useState<BreakPoints>({ 640: 1, 768: 2, 1024: 3, 1280: 5 });
  const [selectData, setSelectData] = useState({ textDirection: 'auto', targetLang: 'CHS', });
  const [refreshData, setRefreshData] = useState(false);
  const { apiKey, modelName } = useUserStore((state) => ({
    apiKey: state.apiKey,
    modelName: state.modelName
  }))

  useLogin(t)

  const TextDirection: { value: string, label: string }[] = [
    { value: 'auto', label: t('home:textDirection.auto') },
    { value: 'row', label: t('home:textDirection.row') },
    { value: 'column', label: t('home:textDirection.column') },
  ]

  const TargetLang: Array<{ label: string, value: string }> = [
    { value: 'CHS', label: t('home:targetLang.Simplified_Chinese') },
    { value: 'CHT', label: t('home:targetLang.Traditional_Chinese') },
    { value: 'CSY', label: t('home:targetLang.Czech') },
    { value: 'NLD', label: t('home:targetLang.Dutch') },
    { value: 'ENG', label: t('home:targetLang.English') },
    { value: 'FRA', label: t('home:targetLang.French') },
    { value: 'DEU', label: t('home:targetLang.German') },
    { value: 'HUN', label: t('home:targetLang.Hungarian') },
    { value: 'ITA', label: t('home:targetLang.Italian') },
    { value: 'JPN', label: t('home:targetLang.Japanese') },
    { value: 'KOR', label: t('home:targetLang.Korean') },
    { value: 'PLK', label: t('home:targetLang.Polish') },
    { value: 'PTB', label: t('home:targetLang.Portuguese') },
    { value: 'ROM', label: t('home:targetLang.Romanian') },
    { value: 'RUS', label: t('home:targetLang.Russian') },
    { value: 'ESP', label: t('home:targetLang.Spanish') },
    { value: 'TRK', label: t('home:targetLang.Turkish') },
    { value: 'UKR', label: t('home:targetLang.Ukrainian') },
    { value: 'VIN', label: t('home:targetLang.Vietnamese') },
    { value: 'CNR', label: t('home:targetLang.Montenegrin') },
    { value: 'SRP', label: t('home:targetLang.Serbian') },
    { value: 'HRV', label: t('home:targetLang.Croatian') },
    { value: 'ARA', label: t('home:targetLang.Arabic') },
    { value: 'THA', label: t('home:targetLang.Thai') },
    { value: 'IND', label: t('home:targetLang.Indonesian') }
  ];

  const handleScroll = () => {
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight && !isLoading) {
      onGetData()
    }
  };

  const handleChooseImageClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleDownload = (src: string) => {
    if (!src) return;
    fetch(src)
      .then(response => response.blob()) // 将图片转换为 blob
      .then(blob => {
        const url = window.URL.createObjectURL(blob); // 创建图片的 URL
        const link = document.createElement('a');
        link.href = url;
        link.download = uuidV4(); // 设置文件名为 item.id，也可以根据需求自定义
        document.body.appendChild(link);
        link.click(); // 触发下载
        document.body.removeChild(link); // 移除临时元素
        window.URL.revokeObjectURL(url); // 释放 URL 对象
      })
      .catch(error => {
        toast(t('home:image_download_error'))
      });
  };

  const onDelete = async (src: string) => {
    const id = Object.keys(dataSource).find(key => dataSource[+key].translateSrc === src || dataSource[+key].src === src);
    console.log(id);
    if (id) {
      setDataSource((prevDataSource) => {
        // 创建新的对象，并排除目标 id
        const { [+id]: _, ...newDataSource } = prevDataSource;
        return newDataSource;
      });
      await deleteData(+id);
      await onGetData()
    }
  }

  const onGetData = async () => {
    setIsLoading(true)
    const page = Object.keys(dataSource).length;
    const data = await getData(page);
    if (data) {
      let newData: { [key: number]: IDataSource } = {};
      Object.keys(data).forEach(async (id: string) => {
        const tempData = data[+id];
        if (!translateIds.current.includes(+id)) {
          // 不是正在翻译的图片就删除
          if (tempData.status === 4) {
            await deleteData(+id);
            return;
          }
        }
        newData[+id] = { ...tempData }
      })
      setDataSource(newData)
      setRefreshData(v => !v)
    }
    setIsLoading(false);
  }

  const onDrop = (event: React.DragEvent) => {
    event.preventDefault();
    const file = event.dataTransfer.files;
    if (file) {
      onGeneratePromptImageFunc(file);
    }
  };

  const onDragOver = (event: React.DragEvent) => {
    event.preventDefault();
  };

  const onSelectBox = (type: 'textDirection' | 'targetLang') => {
    const data = type === 'textDirection' ? TextDirection : TargetLang;
    const onValueChange = (value: string) => {
      setSelectData((v) => ({ ...v, [type]: value }))
    }
    return (
      <Select value={selectData[type]} onValueChange={onValueChange}>
        <SelectTrigger className="w-[180px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {
            data.map((item) => (
              <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
            ))
          }
        </SelectContent>
      </Select>
    )
  }

  const onGeneratePromptImageFunc = async (files: FileList | null) => {
    if (!files || !files?.length) return;
    const uploadPromises = Array.from(files).map(async (file) => {
      setIsLoading(true)
      const params: IDataSource = { src: '', status: 4, message: t('home:image_upload'), createdAt: dayjs().format('YYYY-MM-DD HH:mm:ss') }
      const saveData = await addData({ ...params });
      if (!saveData?.id) return;
      let id = saveData.id;
      let data = { [id]: saveData }
      translateIds.current.push(id)
      setDataSource((v) => ({ [id]: { ...data[id] }, ...v, }))
      setIsLoading(false)
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('need_compress', 'true');
        const imageResult: any = await ky(`${process.env.NEXT_PUBLIC_IMAGE_FETCH_URL}/gpt/api/upload/gpt/image`, {
          method: 'POST',
          body: formData,
          timeout: false,
        }).then(res => res.json());
        if (!imageResult?.data?.url) {
          toast(t('home:upload_error'));
          translateIds.current.splice(translateIds.current.findIndex(f => f === id), 1)
          await deleteData(+id);
          await onGetData();
          return;
        }

        const imgUrl = imageResult.data.url;
        // const imgUrl = 'https://file.302ai.cn/gpt/imgs/20240922/32e5ee9fbb374143bd36f0ac0825616d.webp';
        data = { [id]: { ...data[id], status: 3, src: imgUrl, message: t('home:lineUp_text') } } as any
        setDataSource((v) => ({ ...v, [id]: { ...data[id] } }))

        await updateData(id || 0, { ...data[id] });
        let [horizontal, vertical] = [false, false]
        if (selectData.textDirection === 'row') horizontal = true;
        if (selectData.textDirection === 'column') vertical = true;
        if (id) {
          const fetchData = async () => {
            try {
              const resultId: any = await ky('/api/translateImage', {
                method: 'POST',
                body: JSON.stringify({
                  api_key: apiKey,
                  model: modelName || 'gpt-4o-2024-08-06',
                  // api_key: 'sk-kt2XL6bzGFyanSq5uFdH3DHPAY3wNSIpRHWcwuyfp2oJ0CkT',
                  // model: 'gpt-4o-2024-08-06',
                  imgUrl,
                  targetLang: selectData.targetLang,
                  locale,
                  vertical,
                  horizontal,
                }),
                timeout: false,
                headers: {
                  'Content-Type': 'application/json',
                },
              }).then(res => res.json());
              if (!resultId?.id) {
                emitter.emit('ToastError', resultId?.error?.err_code || '')
                data = { [id]: { ...data[id], message: t('home:translationFailed'), status: -1 } } as any
                setDataSource((v) => ({ ...v, [id]: { ...data[id] } }))
                await updateData(id, { ...data[id] });
              } else {

                await onTranslateResult(data[id], resultId?.id, id)
              }
            } catch (error: any) {
              console.log('===========error', error);
              data = { [id]: { ...data[id], message: t('home:translationFailed'), status: -1 } } as any
              setDataSource((v) => ({ ...v, [id]: { ...data[id] } }))
              translateIds.current.splice(translateIds.current.findIndex(f => f === id), 1)
              await updateData(id, { ...data[id] });
            }
          }
          fetchData();
        }
      } catch (error) {
        console.log('=========error', error);
        toast(t('home:upload_error'));
        translateIds.current.splice(translateIds.current.findIndex(f => f === id), 1)
        await deleteData(+id);
        await onGetData();
      }
    });

    await Promise.all(uploadPromises); // 等待所有上传操作完成
    if (fileInputRef?.current) {
      fileInputRef.current.value = '';
    }
  }

  const onTranslateResult = async (params: IDataSource, resultId: string, id: number) => {
    let data = { [id]: { ...params, requestId: resultId } };
    await updateData(id, { ...data[id] });
    try {
      const response = await ky('/api/translateResult', {
        method: 'POST',
        body: JSON.stringify({ id: resultId }),
        timeout: false,
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let done = false;
      while (!done) {
        // @ts-ignore
        const { value, done: readerDone } = await reader?.read();
        done = readerDone;
        const chunk = decoder.decode(value, { stream: true });
        let lines = chunk.split('\n');
        console.log(chunk);
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].length) {
            const result = JSON.parse(lines[i])
            if (result.output.status === 'finish') {
              data = { [id]: { ...data[id], message: '', translateSrc: result.output.upload_url, status: 1 } }
              await updateData(id, { ...data[id] });
              setDataSource((v) => ({ ...v, [id]: { ...data[id] } }))
              translateIds.current.splice(translateIds.current.findIndex(f => f === id), 1)
            } else if (result.output.status === 'Error') {
              data = { [id]: { ...data[id], message: result.output.msg, translateSrc: '', status: -1 } }
              await updateData(id, { ...data[id] });
              setDataSource((v) => ({ ...v, [id]: { ...data[id] } }))
              translateIds.current.splice(translateIds.current.findIndex(f => f === id), 1)
            } else {
              data = { [id]: { ...data[id], message: result.output.msg } }
              await updateData(id, { ...data[id] });
              setDataSource((v) => ({ ...v, [id]: { ...data[id] } }))
            }
          }
        }
      }
    } catch (error) {
      await checkTranslateStatus(data[id], +id)
      console.log('=========error', error);
    }
  }

  const onGetColumns = (num: number) => {
    if (num > 4) {
      setColumns({ 640: 1, 768: 2, 1024: 3, 1280: 5 })
    } else if (num === 4) {
      setColumns({ 640: 1, 768: 2, 1024: 3, 1280: 4 })
    } else if (num === 3) {
      setColumns({ 640: 1, 768: 2, 1024: 3, 1280: 3 })
    } else if (num === 2) {
      setColumns({ 640: 1, 768: 2, 1024: 2, 1280: 2 })
    } else {
      setColumns({ 640: 1, 768: 1, 1024: 1, 1280: 1 })
    }
  }

  const checkTranslateStatus = async (tempData: IDataSource, id: number) => {
    if (![-1, -2, 1].includes(tempData.status) && tempData.requestId) {
      try {
        const result: any = await ky('/api/translateStatus', {
          method: 'POST',
          body: JSON.stringify({ id: tempData.requestId }),
          timeout: false,
          headers: {
            'Content-Type': 'application/json',
          },
        }).then(res => res.json());
        if (result.status === 'IN_PROGRESS') {
          onTranslateResult(tempData, tempData.requestId, +id)
          translateIds.current.push(+id)
          return;
        }
        // @ts-ignore
        if (result?.output) {
          // @ts-ignore
          const output = result.output[result.output.length - 1]
          if (output.status === 'finish') {
            const data = { ...tempData, message: '', translateSrc: output.upload_url, status: 1 }
            await updateData(+id, { ...data });
            setDataSource((v) => ({ ...v, [id]: { ...data } }))
          } else if (output.status === 'Error') {
            const data = { ...tempData, message: output.msg, translateSrc: '', status: -1 }
            await updateData(+id, { ...data });
            setDataSource((v) => ({ ...v, [id]: { ...data } }))
          }
          translateIds.current.splice(translateIds.current.findIndex(f => f === id), 1)
        }
      } catch (error) { }
    }
  }

  useEffect(() => {
    setIsLoading(true);
    onGetData();
  }, [])

  // 监听滚动事件
  useEffect(() => {
    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll); // 清除事件监听
    };
  }, [isLoading]);

  useEffect(() => {
    const num = Object.keys(dataSource).length;
    onGetColumns(num);

  }, [dataSource])

  useEffect(() => {
    Object.keys(dataSource).forEach(async (id: string) => {
      const tempData = dataSource[+id];
      if (!translateIds.current.includes(+id)) {
        if (![-1, -2, 1].includes(tempData.status) && tempData.requestId) {
          await checkTranslateStatus(tempData, +id)
        }
      }
    })
  }, [refreshData])

  return (
    <div onDrop={onDrop} onDragOver={onDragOver} >
      <div className='my-0 mx-auto pt-10 pb-5 w-full p-3 md:max-w-[1300px]'>
        <div className='flex items-center w-full justify-center lg:mb-16 mb-5'>
          <Image alt='ai-302-logo' src={logo_302} quality={100} height={65} width={65} />
          <div className='text-2xl ml-5 font-bold'>{t('home:title')}</div>
        </div>
        <div className='flex justify-center items-end flex-wrap'>
          <div className='p-3'>
            <p className='text-xs mb-2'>{t('home:textDirection.title')}</p>
            {onSelectBox('textDirection')}
          </div>
          <div className='p-3'>
            <p className='text-xs mb-2'>{t('home:targetLang.title')}</p>
            {onSelectBox('targetLang')}
          </div>
          <div className='p-3'>
            <Button className="w-[180px]" onClick={handleChooseImageClick} >
              <input type="file" multiple accept="image/*" style={{ display: 'none' }} ref={fileInputRef} onChange={(e) => onGeneratePromptImageFunc(e.target.files)} />
              {t('home:select_file')}
            </Button>
          </div>
        </div>
        <p className='text-xs text-slate-600 text-center pb-5 pt-2'>{t('home:upload_notice')}</p>
        <div style={{ minHeight: 'calc(100vh - 362px)', border: Object.keys(dataSource).length ? '' : '1px dashed #000' }} className=' relative'>
          <div className={`absolute w-full h-full cursor-pointer ${!Object.keys(dataSource).length ? '' : 'hidden'}`} onClick={handleChooseImageClick}>
            <MdOutlineDriveFolderUpload className='text-8xl text-[#7e7e7e] absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2' />
          </div>
          <PhotoProvider maskOpacity={0.8} loop={true} toolbarRender={({ images, index, onIndexChange, onClose }) => {
            console.log(index, images);

            return (
              <div className='flex items-center gap-3'>
                <MdDeleteOutline className='text-2xl opacity-75 cursor-pointer hover:opacity-100 transition-all' onClick={() => { onDelete(images[index]?.src || '') }} />
                <GoDownload className='text-2xl opacity-75 cursor-pointer hover:opacity-100 transition-all' onClick={() => { handleDownload(images[index]?.src || '') }} />
              </div>
            );
          }}>
            <Masonry columns={columns} gap={10}>
              {Object.keys(dataSource).sort((a, b) => +b - +a).map(key => {
                if (dataSource[+key].status > 1) {
                  return (
                    <div key={key} className={`relative cursor-pointer group ${dataSource[+key].status !== 1 ? 'pointer-events-none' : ''}`}>
                      {
                        !(dataSource[+key].translateSrc || dataSource[+key].src) ?
                          <div className={`cursor-pointer rounded-sm w-full h-[230px]`}>
                            <MdOutlineDriveFolderUpload className='text-8xl text-[#7e7e7e] absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2' />
                          </div> :
                          <img src={dataSource[+key].translateSrc || dataSource[+key].src || ''} className={`cursor-pointer rounded-sm w-full`} />
                      }
                      <div className={`${dataSource[+key].status === 1 ? 'hidden' : 'flex'} absolute left-0 top-0 w-full h-full bg-[#56565685] items-center justify-center flex-col gap-3`}>
                        <SkFadingCircle />
                        <div className='text-[#fff]'>
                          {dataSource[+key]?.message || ''}
                        </div>
                      </div>
                    </div>
                  )
                }
                if (dataSource[+key].status < 1) {
                  return (
                    <PhotoView key={key} src={dataSource[+key].translateSrc || dataSource[+key].src}>
                      <div className={`relative cursor-pointer group`}>
                        {key}
                        <img src={dataSource[+key].translateSrc || dataSource[+key].src} className='cursor-pointer rounded-sm w-full' />
                        <div className={`${dataSource[+key].status === 1 ? 'hidden' : 'flex'} absolute left-0 top-0 w-full h-full bg-[#56565685] items-center justify-center flex-col gap-3`}>
                          <IoWarningSharp className='text-red-700 text-6xl' />
                          <div className='text-[#fff]'>
                            {dataSource[+key]?.message || ''}
                          </div>
                        </div>
                      </div>
                    </PhotoView>
                  )
                }
                return (
                  <PhotoView key={key} src={dataSource[+key].translateSrc || dataSource[+key].src}>
                    <div className={`relative cursor-pointer group`}>
                      {key}
                      <img src={dataSource[+key].translateSrc || dataSource[+key].src} className='cursor-pointer rounded-sm w-full' />
                    </div>
                  </PhotoView>
                )
              })}
            </Masonry>
          </PhotoProvider>
        </div>
      </div>
      <Footer className='pb-3' />
    </div >
  )
}
