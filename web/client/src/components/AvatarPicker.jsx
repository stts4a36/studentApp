import { useRef } from 'react'
import TeacherFace from './TeacherFace'

export default function AvatarPicker({ src, name, id, onFile, size = 88, colorIndex }) {
  const inputRef = useRef(null)
  return (
    <div className="avatar-picker">
      <button type="button" className="avatar-picker-btn" onClick={() => inputRef.current?.click()} style={{ width: size, height: size }}>
        <TeacherFace src={src} name={name} id={id} size={size} colorIndex={colorIndex} />
        <span className="avatar-picker-hint">更換</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={e => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (file) onFile(file)
        }}
      />
    </div>
  )
}
