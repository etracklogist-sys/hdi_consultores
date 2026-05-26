import io
filepath = r'frontend/src/pages/ClienteDetail.jsx'
with io.open(filepath, 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
for line in lines:
    if 'Agregar Empleado' in line and 'onClick={() => { setEmpError(null); setEmpForm' in line:
        continue
    new_lines.append(line)

with io.open(filepath, 'w', encoding='utf-8', newline='') as f:
    f.writelines(new_lines)
print('Done!')
