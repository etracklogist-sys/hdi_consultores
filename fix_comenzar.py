import io

filepath = r'frontend/src/pages/EmpleadoPortal.jsx'
with io.open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

old_comenzar = '''  const handleComenzar = async (training) => {
    setActionLoading(true);
    setActiveCourse(training);
    try {
      // If training requires evaluation and material has been viewed, skip to eval
      if (training.requiere_evaluacion && training.material_viewed) {
        handleStartEvaluation(training);
        return;
      }
      
      // Fetch materials from mock service using capacitacion catalog id
      const mats = await materialService.getMaterialesByCapacitacion(training.id); 
      setCourseMaterials(mats.filter(m => m.activo));
      
      // Mark material as viewed on the backend (does NOT complete the training)
      employeeService.markMaterialViewed(training.id).catch(() => {});
      
      setView('materials');
    } catch (err) {
      handleError(err);
    } finally {
      setActionLoading(false);
    }
  };'''

new_comenzar = '''  const handleComenzar = async (training) => {
    setActionLoading(true);
    setActiveCourse(training);
    try {
      // Always show materials first when starting a course
      const mats = await materialService.getMaterialesByCapacitacion(training.id); 
      setCourseMaterials(mats.filter(m => m.activo));
      
      // Mark material as viewed on the backend (does NOT complete the training)
      employeeService.markMaterialViewed(training.id).catch(() => {});
      
      setView('materials');
    } catch (err) {
      handleError(err);
    } finally {
      setActionLoading(false);
    }
  };'''

if old_comenzar in content:
    content = content.replace(old_comenzar, new_comenzar)
    with io.open(filepath, 'w', encoding='utf-8', newline='') as f:
        f.write(content)
    print('OK: handleComenzar updated')
else:
    print('ERROR: old_comenzar not found')
