// Empaquetado de rúbricas para importar en Schoology / CREA / Moodle:
//  - Common Cartridge (.imscc): la rúbrica entra como página de contenido.
//  - Backup de Moodle (.mbz/.zip): intenta la rúbrica como método de
//    calificación de una tarea (gradingform_rubric).
// Ambos paquetes son ZIP (Schoology acepta "Moodle (ZIP or MBZ)").
import { exportarRubricaHTML } from './export-rubrica.js';

function esc(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function uid(prefix) {
  return (prefix || 'id') + Math.random().toString(36).substring(2, 12);
}

function nombreBase(titulo) {
  return (titulo || 'rubrica').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9_-]+/gi, '_').replace(/^_+|_+$/g, '').slice(0, 50) || 'rubrica';
}

// ============================================================
//  COMMON CARTRIDGE (.imscc) — rúbrica como página web
// ============================================================
export async function generarRubricaIMSCC(rubrica, titulo) {
  const manifestId = uid('M');
  const resId = uid('R');
  const itemId = uid('I');
  const carpeta = 'rubrica';
  const htmlPage = exportarRubricaHTML(rubrica, titulo);

  const manifest = `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="${manifestId}"
  xmlns="http://www.imsglobal.org/xsd/imsccv1p1/imscp_v1p1"
  xmlns:lomimscc="http://ltsc.ieee.org/xsd/imsccv1p1/LOM/manifest"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsglobal.org/xsd/imsccv1p1/imscp_v1p1 http://www.imsglobal.org/profile/cc/ccv1p1/ccv1p1_imscp_v1p2_v1p0.xsd">
  <metadata>
    <schema>IMS Common Cartridge</schema>
    <schemaversion>1.1.0</schemaversion>
  </metadata>
  <organizations>
    <organization identifier="org_1" structure="rooted-hierarchy">
      <item identifier="root">
        <item identifier="${itemId}" identifierref="${resId}">
          <title>${esc(titulo || 'Rúbrica')}</title>
        </item>
      </item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="${resId}" type="webcontent" href="${carpeta}/rubrica.html">
      <file href="${carpeta}/rubrica.html"/>
    </resource>
  </resources>
</manifest>`;

  const zip = new JSZip();
  zip.file('imsmanifest.xml', manifest);
  zip.file(`${carpeta}/rubrica.html`, htmlPage);
  return zip.generateAsync({ type: 'blob', mimeType: 'application/zip' });
}

// ============================================================
//  BACKUP DE MOODLE (.mbz como ZIP)
// ============================================================
export async function generarRubricaMBZ(rubrica, titulo) {
  const ts = Math.floor(Date.now() / 1000);
  const MOODLE_VERSION = '2022112800';  // Moodle 4.1 LTS
  const MOODLE_RELEASE = '4.1';
  const nombre = nombreBase(titulo);
  const maxPts = Math.max(...rubrica.niveles.map(n => n.puntos));
  const maxGrade = rubrica.criterios.reduce((s, c) => s + (c.peso || 1) * maxPts, 0) || 100;
  const ctxAssign = 100;
  const ctxCourse = 50;
  const ctxSystem = 1;

  const zip = new JSZip();

  // ---- moodle_backup.xml ----
  zip.file('moodle_backup.xml', moodleBackupXml());

  // ---- archivos de nivel raíz (vacíos pero requeridos) ----
  zip.file('files.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<files></files>`);
  zip.file('scales.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<scales_definition></scales_definition>`);
  zip.file('outcomes.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<outcomes_definition></outcomes_definition>`);
  zip.file('roles.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<roles_definition></roles_definition>`);
  zip.file('questions.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<question_categories></question_categories>`);
  zip.file('groups.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<groups></groups>`);
  zip.file('gradehistory.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<grade_history></grade_history>`);

  // ---- carpeta de la actividad ----
  const dir = 'activities/assign_1';
  zip.file(`${dir}/assign.xml`, assignXml());
  zip.file(`${dir}/module.xml`, moduleXml());
  zip.file(`${dir}/grading.xml`, gradingXml());
  zip.file(`${dir}/inforef.xml`, `<?xml version="1.0" encoding="UTF-8"?>\n<inforef></inforef>`);
  zip.file(`${dir}/roles.xml`, `<?xml version="1.0" encoding="UTF-8"?>\n<roles><role_overrides></role_overrides><role_assignments></role_assignments></roles>`);
  zip.file(`${dir}/grades.xml`, `<?xml version="1.0" encoding="UTF-8"?>\n<activity_gradebook><grade_items></grade_items><grade_letters></grade_letters></activity_gradebook>`);
  zip.file(`${dir}/comments.xml`, `<?xml version="1.0" encoding="UTF-8"?>\n<comments></comments>`);
  zip.file(`${dir}/calendar.xml`, `<?xml version="1.0" encoding="UTF-8"?>\n<calendar><events></events></calendar>`);
  zip.file(`${dir}/completion.xml`, `<?xml version="1.0" encoding="UTF-8"?>\n<completions><completions></completions></completions>`);

  return zip.generateAsync({ type: 'blob', mimeType: 'application/zip' });

  // ---------- generadores de XML (closures) ----------

  function moodleBackupXml() {
    return `<?xml version="1.0" encoding="UTF-8"?>
<moodle_backup>
  <information>
    <name>backup-moodle2-activity-1-assign-${esc(nombre)}.mbz</name>
    <moodle_version>${MOODLE_VERSION}</moodle_version>
    <moodle_release>${MOODLE_RELEASE}</moodle_release>
    <backup_version>${MOODLE_VERSION}</backup_version>
    <backup_release>${MOODLE_RELEASE}</backup_release>
    <backup_date>${ts}</backup_date>
    <mnet_remoteusers>0</mnet_remoteusers>
    <include_files>1</include_files>
    <include_file_references_to_external_content>0</include_file_references_to_external_content>
    <original_wwwroot>https://moodle.local</original_wwwroot>
    <original_site_identifier_hash>${uid('h')}</original_site_identifier_hash>
    <original_course_id>2</original_course_id>
    <original_course_format>topics</original_course_format>
    <original_course_fullname>${esc(titulo || 'Rúbrica')}</original_course_fullname>
    <original_course_shortname>${esc(nombre)}</original_course_shortname>
    <original_course_startdate>${ts}</original_course_startdate>
    <original_course_contextid>${ctxCourse}</original_course_contextid>
    <original_system_contextid>${ctxSystem}</original_system_contextid>
    <details>
      <detail backup_id="${uid('b')}">
        <type>activity</type>
        <format>moodle2</format>
        <interactive>1</interactive>
        <mode>10</mode>
        <execution>1</execution>
        <executiontime>0</executiontime>
      </detail>
    </details>
    <contents>
      <activities>
        <activity>
          <moduleid>1</moduleid>
          <sectionid>1</sectionid>
          <modulename>assign</modulename>
          <title>${esc(titulo || 'Rúbrica')}</title>
          <directory>activities/assign_1</directory>
          <insubsection></insubsection>
        </activity>
      </activities>
      <settings>
        <setting>
          <level>root</level>
          <name>filename</name>
          <value>backup-moodle2-activity-1-assign-${esc(nombre)}.mbz</value>
        </setting>
        <setting><level>root</level><name>users</name><value>0</value></setting>
        <setting><level>root</level><name>anonymize</name><value>0</value></setting>
        <setting><level>root</level><name>role_assignments</name><value>0</value></setting>
        <setting><level>root</level><name>activities</name><value>1</value></setting>
        <setting><level>root</level><name>blocks</name><value>0</value></setting>
        <setting><level>root</level><name>files</name><value>1</value></setting>
        <setting><level>root</level><name>filters</name><value>0</value></setting>
        <setting><level>root</level><name>comments</name><value>0</value></setting>
        <setting><level>root</level><name>badges</name><value>0</value></setting>
        <setting><level>root</level><name>calendarevents</name><value>0</value></setting>
        <setting><level>root</level><name>userscompletion</name><value>0</value></setting>
        <setting><level>root</level><name>logs</name><value>0</value></setting>
        <setting><level>root</level><name>grade_histories</name><value>0</value></setting>
        <setting><level>root</level><name>questionbank</name><value>0</value></setting>
        <setting><level>root</level><name>groups</name><value>0</value></setting>
        <setting><level>root</level><name>competencies</name><value>0</value></setting>
        <setting><level>root</level><name>customfield</name><value>0</value></setting>
        <setting><level>root</level><name>contentbankcontent</name><value>0</value></setting>
        <setting><level>root</level><name>xapistate</name><value>0</value></setting>
        <setting><level>root</level><name>legacyfiles</name><value>0</value></setting>
        <setting>
          <level>activity</level>
          <activity>assign_1</activity>
          <name>assign_1_included</name>
          <value>1</value>
        </setting>
        <setting>
          <level>activity</level>
          <activity>assign_1</activity>
          <name>assign_1_userinfo</name>
          <value>0</value>
        </setting>
      </settings>
    </contents>
  </information>
</moodle_backup>`;
  }

  function assignXml() {
    return `<?xml version="1.0" encoding="UTF-8"?>
<activity id="1" moduleid="1" modulename="assign" contextid="${ctxAssign}">
  <assign id="1">
    <name>${esc(titulo || 'Rúbrica')}</name>
    <intro>&lt;p&gt;Actividad evaluada con rúbrica.&lt;/p&gt;</intro>
    <introformat>1</introformat>
    <alwaysshowdescription>1</alwaysshowdescription>
    <submissiondrafts>0</submissiondrafts>
    <sendnotifications>0</sendnotifications>
    <sendlatenotifications>0</sendlatenotifications>
    <duedate>0</duedate>
    <cutoffdate>0</cutoffdate>
    <gradingduedate>0</gradingduedate>
    <allowsubmissionsfromdate>0</allowsubmissionsfromdate>
    <grade>${maxGrade}</grade>
    <timemodified>${ts}</timemodified>
    <completionsubmit>0</completionsubmit>
    <requiresubmissionstatement>0</requiresubmissionstatement>
    <teamsubmission>0</teamsubmission>
    <requireallteammemberssubmit>0</requireallteammemberssubmit>
    <teamsubmissiongroupingid>0</teamsubmissiongroupingid>
    <blindmarking>0</blindmarking>
    <hidegrader>0</hidegrader>
    <revealidentities>0</revealidentities>
    <attemptreopenmethod>none</attemptreopenmethod>
    <maxattempts>-1</maxattempts>
    <markingworkflow>0</markingworkflow>
    <markingallocation>0</markingallocation>
    <markinganonymous>0</markinganonymous>
    <sendstudentnotifications>1</sendstudentnotifications>
    <preventsubmissionnotingroup>0</preventsubmissionnotingroup>
    <timelimit>0</timelimit>
    <submissionattachments>0</submissionattachments>
    <configs>
      <config>
        <plugin>file</plugin>
        <subtype>assignsubmission</subtype>
        <name>enabled</name>
        <value>1</value>
      </config>
      <config>
        <plugin>onlinetext</plugin>
        <subtype>assignsubmission</subtype>
        <name>enabled</name>
        <value>1</value>
      </config>
      <config>
        <plugin>comments</plugin>
        <subtype>assignfeedback</subtype>
        <name>enabled</name>
        <value>1</value>
      </config>
    </configs>
    <submissions></submissions>
    <grades></grades>
    <userflags></userflags>
    <mappings></mappings>
    <overrides></overrides>
  </assign>
</activity>`;
  }

  function moduleXml() {
    return `<?xml version="1.0" encoding="UTF-8"?>
<module id="1" version="${MOODLE_VERSION}">
  <modulename>assign</modulename>
  <sectionid>1</sectionid>
  <sectionnumber>0</sectionnumber>
  <idnumber></idnumber>
  <added>${ts}</added>
  <score>0</score>
  <indent>0</indent>
  <visible>1</visible>
  <visibleoncoursepage>1</visibleoncoursepage>
  <visibleold>1</visibleold>
  <groupmode>0</groupmode>
  <groupingid>0</groupingid>
  <completion>0</completion>
  <completiongradeitemnumber>$@NULL@$</completiongradeitemnumber>
  <completionview>0</completionview>
  <completionexpected>0</completionexpected>
  <completionpassgrade>0</completionpassgrade>
  <availability>$@NULL@$</availability>
  <showdescription>0</showdescription>
  <downloadcontent>1</downloadcontent>
  <tags></tags>
</module>`;
  }

  function gradingXml() {
    let criteriosXml = '';
    let critId = 1;
    let levelId = 1;
    rubrica.criterios.forEach((crit) => {
      let nivelesXml = '';
      rubrica.niveles.forEach((niv, ni) => {
        const score = ((crit.peso || 1) * niv.puntos).toFixed(5);
        const def = crit.descripciones[ni] || niv.nombre;
        nivelesXml += `
              <rubric_level id="${levelId++}">
                <score>${score}</score>
                <definition>${esc(def)}</definition>
                <definitionformat>0</definitionformat>
              </rubric_level>`;
      });
      criteriosXml += `
            <rubric_criterion id="${critId}">
              <sortorder>${critId}</sortorder>
              <description>${esc(crit.nombre)}</description>
              <descriptionformat>0</descriptionformat>
              <rubric_levels>${nivelesXml}
              </rubric_levels>
            </rubric_criterion>`;
      critId++;
    });

    return `<?xml version="1.0" encoding="UTF-8"?>
<areas>
  <area id="1">
    <areaname>submissions</areaname>
    <activemethod>rubric</activemethod>
    <definitions>
      <definition id="1">
        <method>rubric</method>
        <name>${esc(titulo || 'Rúbrica')}</name>
        <description>&lt;p&gt;Rúbrica generada con el Generador de Actividades.&lt;/p&gt;</description>
        <descriptionformat>1</descriptionformat>
        <status>20</status>
        <timecreated>${ts}</timecreated>
        <timemodified>${ts}</timemodified>
        <usercreated>2</usercreated>
        <usermodified>2</usermodified>
        <timecopied>0</timecopied>
        <plugin_gradingform_rubric_definition>
          <rubric_criteria>${criteriosXml}
          </rubric_criteria>
        </plugin_gradingform_rubric_definition>
      </definition>
    </definitions>
  </area>
</areas>`;
  }
}
