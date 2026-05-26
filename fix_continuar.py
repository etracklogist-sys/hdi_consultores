import io

filepath = r'frontend/src/pages/EmpleadoPortal.jsx'
with io.open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

old_handler = '''  const handleContinuar = async (training) => {
    setActionLoading(true);
    setActiveCourse(training);
    setActiveIntento(training.intento_id);
    try {
      const qData = await employeeService.getPreguntasEvaluacion(training.intento_id);
      setQuestions(qData);
      setCurrentQIndex(0);
      setSelectedOption(null);
      setEvalProgress({
        total_preguntas: qData.length,
        respondidas: qData.filter(q => q.respondida).length,
        porcentaje_avance: qData.length > 0 ? (qData.filter(q => q.respondida).length / qData.length) * 100 : 0
      });
      setView('evaluation');
    } catch (err) {
      handleError(err);
    } finally {
      setActionLoading(false);
    }
  };'''

new_handler = '''  const handleContinuar = async (training) => {
    setActionLoading(true);
    setActiveCourse(training);
    setActiveIntento(training.intento_id);
    try {
      // If material hasn't been viewed yet, show materials first
      if (!training.material_viewed) {
        const mats = await materialService.getMaterialesByCapacitacion(training.id);
        setCourseMaterials(mats.filter(m => m.activo));
        employeeService.markMaterialViewed(training.id).catch(() => {});
        setView('materials');
        return;
      }
      // Material already viewed, go to evaluation
      const qData = await employeeService.getPreguntasEvaluacion(training.intento_id);
      setQuestions(qData);
      setCurrentQIndex(0);
      setSelectedOption(null);
      setEvalProgress({
        total_preguntas: qData.length,
        respondidas: qData.filter(q => q.respondida).length,
        porcentaje_avance: qData.length > 0 ? (qData.filter(q => q.respondida).length / qData.length) * 100 : 0
      });
      setView('evaluation');
    } catch (err) {
      handleError(err);
    } finally {
      setActionLoading(false);
    }
  };'''

if old_handler in content:
    content = content.replace(old_handler, new_handler)
    with io.open(filepath, 'w', encoding='utf-8', newline='') as f:
        f.write(content)
    print('OK: handleContinuar updated')
else:
    print('ERROR: old_handler not found')
