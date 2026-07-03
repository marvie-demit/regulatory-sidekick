begin;
-- Regen roadmap: remap per-org activity statuses old id -> new step id.
-- Collision-safe: where 2 old activities merge into 1 step, keep the most-advanced status.
-- task_completion is NOT remapped (sub-activity indices changed) -> checkboxes reset.
-- NB: the CTE only scopes to the INSERT; the deletes use inline id lists.
with remap(oldid, newid) as (values ('P1.1','DOC.establish'), ('P1.2','QMN.establish'), ('P1.3','DOC.establish'), ('P1.4','QMN.establish'), ('P1.5','HRT.establish'), ('P1.6','INF.establish'), ('P1.7','SWD.plan'), ('P1.8','CMP.setup'), ('P1.9','DPR.establish'), ('P2.1','RSK.plan'), ('P2.10','CAP.setup'), ('P2.11','CHG.setup'), ('P2.12','PRO.setup'), ('P2.13','PRO.setup'), ('P2.14','STE.setup'), ('P2.15','INF.metrology'), ('P2.16','PSA.setup'), ('P2.17','PSA.setup'), ('P2.18','AES.setup'), ('P2.19','BIO.setup'), ('P2.2','DEV.establish'), ('P2.20','CMB.setup'), ('P2.21','CMD.setup'), ('P2.22','DEV.ivd'), ('P2.23','RSK.ivd'), ('P2.24','RSK.ivd'), ('P2.25','NCP.setup'), ('P2.3','SWD.verify'), ('P2.4','HUF.plan'), ('P2.5','ISM.establish'), ('P2.6','DPR.assess'), ('P2.7','AIM.plan'), ('P2.8','INF.csv'), ('P2.9','PUR.establish'), ('P3.1','AUD.establish'), ('P3.2','MRV.establish'), ('P3.3','REG.establish'), ('P3.4','BCP.establish'), ('P3.5','HRT.mature'), ('P3.6','PUR.surveil'), ('P3.7','AIM.build'), ('P4.1','CLE.plan'), ('P4.10','DEP.plan'), ('P4.11','TEF.file'), ('P4.12','VIG.us'), ('P4.2','PMS.plan'), ('P4.3','TEF.market.mdr'), ('P4.4','SAL.setup'), ('P4.5','AUD.establish'), ('P4.6','TEF.certify.stage1'), ('P4.7','TEF.certify.stage2'), ('P4.8','PEV.plan'), ('P4.9','PMS.ivd'))
insert into activity_status (org_id, activity_id, status, updated_by, updated_at)
select s.org_id, r.newid, s.status, s.updated_by, s.updated_at
from activity_status s join remap r on s.activity_id = r.oldid
on conflict (org_id, activity_id) do update set status =
  case when (case excluded.status when 'done' then 3 when 'in_progress' then 2 when 'na' then 1 else 0 end)
          > (case activity_status.status when 'done' then 3 when 'in_progress' then 2 when 'na' then 1 else 0 end)
       then excluded.status else activity_status.status end;

-- remove the old-id rows
delete from activity_status where activity_id in ('P1.1', 'P1.2', 'P1.3', 'P1.4', 'P1.5', 'P1.6', 'P1.7', 'P1.8', 'P1.9', 'P2.1', 'P2.10', 'P2.11', 'P2.12', 'P2.13', 'P2.14', 'P2.15', 'P2.16', 'P2.17', 'P2.18', 'P2.19', 'P2.2', 'P2.20', 'P2.21', 'P2.22', 'P2.23', 'P2.24', 'P2.25', 'P2.3', 'P2.4', 'P2.5', 'P2.6', 'P2.7', 'P2.8', 'P2.9', 'P3.1', 'P3.2', 'P3.3', 'P3.4', 'P3.5', 'P3.6', 'P3.7', 'P4.1', 'P4.10', 'P4.11', 'P4.12', 'P4.2', 'P4.3', 'P4.4', 'P4.5', 'P4.6', 'P4.7', 'P4.8', 'P4.9');

-- reset now-stale sub-task checkboxes (their activity_ids no longer exist)
delete from task_completion where activity_id in ('P1.1', 'P1.2', 'P1.3', 'P1.4', 'P1.5', 'P1.6', 'P1.7', 'P1.8', 'P1.9', 'P2.1', 'P2.10', 'P2.11', 'P2.12', 'P2.13', 'P2.14', 'P2.15', 'P2.16', 'P2.17', 'P2.18', 'P2.19', 'P2.2', 'P2.20', 'P2.21', 'P2.22', 'P2.23', 'P2.24', 'P2.25', 'P2.3', 'P2.4', 'P2.5', 'P2.6', 'P2.7', 'P2.8', 'P2.9', 'P3.1', 'P3.2', 'P3.3', 'P3.4', 'P3.5', 'P3.6', 'P3.7', 'P4.1', 'P4.10', 'P4.11', 'P4.12', 'P4.2', 'P4.3', 'P4.4', 'P4.5', 'P4.6', 'P4.7', 'P4.8', 'P4.9');

commit;